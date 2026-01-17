// scheduler.js - Background Action Scheduler
// Runs every minute to check and execute scheduled actions

const db = require('./database');
const wax = require('./wax');

// Track if scheduler is running
let isRunning = false;
let schedulerInterval = null;

// Execute a single action
async function executeAction(action) {
  console.log(`⏰ Executing action #${action.id}: ${action.name} (${action.action_type})`);

  try {
    let result = null;

    switch (action.action_type) {
      case 'mint':
        result = await executeMintAction(action);
        break;

      case 'transfer':
        result = await executeTransferAction(action);
        break;

      case 'drop':
        console.log(`   ⚠️ Drop action not yet implemented`);
        throw new Error('Drop action not yet implemented');

      case 'burn':
        console.log(`   ⚠️ Burn action not yet implemented`);
        throw new Error('Burn action not yet implemented');

      default:
        throw new Error(`Unknown action type: ${action.action_type}`);
    }

    // Mark action as completed
    db.scheduledActions.update(action.id, {
      status: 'completed',
      executed_at: new Date().toISOString()
    });

    // Log successful execution
    db.actionExecutions.create({
      action_id: action.id,
      status: 'success',
      transaction_id: result.transaction_id,
      result_data: result
    });

    console.log(`   ✅ Action completed! TX: ${result.transaction_id}`);

    return { success: true, result };

  } catch (error) {
    console.error(`   ❌ Action failed:`, error.message);

    // Mark action as failed
    db.scheduledActions.update(action.id, {
      status: 'failed',
      executed_at: new Date().toISOString(),
      error_message: error.message
    });

    // Log failed execution
    db.actionExecutions.create({
      action_id: action.id,
      status: 'failed',
      error_message: error.message
    });

    return { success: false, error: error.message };
  }
}

// Execute MINT action
async function executeMintAction(action) {
  const params = action.action_params;

  // Validate parameters
  if (!params.to_wallet) {
    throw new Error('Missing required parameter: to_wallet');
  }
  if (!params.template_id) {
    throw new Error('Missing required parameter: template_id');
  }

  const quantity = params.quantity || 1;
  const authorizedMinter = params.authorized_minter || 'futuresrelic';

  console.log(`   🔨 Minting ${quantity}x Template ${params.template_id} to ${params.to_wallet}`);

  const transactions = [];

  // Mint each asset
  for (let i = 0; i < quantity; i++) {
    const mintResult = await wax.mintNFT(
      params.to_wallet,
      authorizedMinter,
      params.template_id
    );
    transactions.push(mintResult.transaction_id);
    console.log(`   ✅ Minted ${i + 1}/${quantity} - TX: ${mintResult.transaction_id}`);
  }

  return {
    transaction_id: transactions[0], // Primary transaction
    all_transactions: transactions,
    minted_count: quantity,
    template_id: params.template_id,
    to_wallet: params.to_wallet
  };
}

// Execute TRANSFER action
async function executeTransferAction(action) {
  const params = action.action_params;

  // Validate parameters
  if (!params.from_wallet) {
    throw new Error('Missing required parameter: from_wallet');
  }
  if (!params.to_wallet) {
    throw new Error('Missing required parameter: to_wallet');
  }
  if (!params.template_id && !params.asset_ids) {
    throw new Error('Missing required parameter: template_id or asset_ids');
  }

  const quantity = params.quantity || 1;
  const memo = params.memo || 'Scheduled transfer';

  console.log(`   📤 Transferring from ${params.from_wallet} to ${params.to_wallet}`);

  // Get private key from environment
  const privateKey = getPrivateKeyForWallet(params.from_wallet);
  if (!privateKey) {
    throw new Error(`No private key configured for wallet: ${params.from_wallet}`);
  }

  let assetIds;

  if (params.asset_ids) {
    // Use specified asset IDs
    assetIds = params.asset_ids;
  } else {
    // Fetch assets by template ID
    console.log(`   🔍 Fetching ${quantity}x Template ${params.template_id} from ${params.from_wallet}`);
    const assets = await wax.getUserAssetsLive(params.from_wallet, 'futuresrelic', [params.template_id]);

    if (assets.length < quantity) {
      throw new Error(`Insufficient assets. Need ${quantity}, have ${assets.length}`);
    }

    assetIds = assets.slice(0, quantity).map(a => a.asset_id);
  }

  console.log(`   📦 Transferring ${assetIds.length} asset(s)...`);

  // Execute transfer
  const transferResult = await wax.transferNFTs(
    params.from_wallet,
    params.to_wallet,
    assetIds,
    memo,
    privateKey
  );

  console.log(`   ✅ Transfer complete - TX: ${transferResult.transaction_id}`);

  return {
    transaction_id: transferResult.transaction_id,
    transferred_count: assetIds.length,
    asset_ids: assetIds,
    from_wallet: params.from_wallet,
    to_wallet: params.to_wallet
  };
}

// Get private key for wallet from environment variables
function getPrivateKeyForWallet(wallet) {
  // Map wallet names to environment variables
  const keyMap = {
    'futuresrelic': process.env.FUTURESRELIC_PRIVATE_KEY,
    'pool.fr': process.env.POOL_FR_PRIVATE_KEY,
    'treasury.fr': process.env.TREASURY_PRIVATE_KEY
  };

  return keyMap[wallet] || null;
}

// Main scheduler loop - runs every minute
async function checkAndExecuteActions() {
  if (isRunning) {
    console.log('⏭️ Scheduler already running, skipping this cycle');
    return;
  }

  isRunning = true;

  try {
    // Get all pending actions that are ready to execute
    const pendingActions = db.scheduledActions.getPending();

    if (pendingActions.length === 0) {
      // No logging when nothing to do (reduces noise)
      isRunning = false;
      return;
    }

    console.log(`\n⏰ Scheduler: Found ${pendingActions.length} pending action(s)`);

    // Execute each action
    for (const action of pendingActions) {
      await executeAction(action);
    }

    console.log(`✅ Scheduler: Completed ${pendingActions.length} action(s)\n`);

  } catch (error) {
    console.error('❌ Scheduler error:', error);
  } finally {
    isRunning = false;
  }
}

// Start the scheduler
function startScheduler() {
  if (schedulerInterval) {
    console.log('⚠️ Scheduler already running');
    return;
  }

  console.log('🚀 Starting Action Scheduler (runs every minute)');

  // Run immediately on start
  checkAndExecuteActions();

  // Then run every minute
  schedulerInterval = setInterval(checkAndExecuteActions, 60 * 1000);
}

// Stop the scheduler
function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('🛑 Scheduler stopped');
  }
}

module.exports = {
  startScheduler,
  stopScheduler,
  checkAndExecuteActions,
  executeAction
};
