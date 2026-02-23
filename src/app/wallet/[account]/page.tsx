import { notFound } from 'next/navigation';
import WalletViewerClient from './WalletViewerClient';
import { isValidWaxAccount } from '@/lib/utils';
import type { Metadata } from 'next';

interface Props {
  params: { account: string };
}

export function generateMetadata({ params }: Props): Metadata {
  return {
    title: `${params.account}'s Wallet | WAX Wallet Viewer`,
    description: `View ${params.account}'s WAX NFT collection on AtomicAssets.`,
  };
}

export default function WalletPage({ params }: Props) {
  const account = params.account.toLowerCase().trim();

  if (!isValidWaxAccount(account)) {
    notFound();
  }

  return <WalletViewerClient account={account} />;
}
