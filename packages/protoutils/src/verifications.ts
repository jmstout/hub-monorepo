import { FarcasterNetwork } from '@farcaster/protobufs';
import { BigNumber } from 'ethers';
import { err, ok } from 'neverthrow';
import { bytesToHexString } from './bytes';
import { HubResult } from './errors';
import { validateBlockHashHex, validateEthAddressHex } from './validations';

export type VerificationEthAddressClaim = {
  fid: BigNumber;
  address: string; // Hex string
  network: FarcasterNetwork;
  blockHash: string; // Hex string
};

export const makeVerificationEthAddressClaim = (
  fid: number,
  ethAddress: Uint8Array,
  network: FarcasterNetwork,
  blockHash: Uint8Array
): HubResult<VerificationEthAddressClaim> => {
  const ethAddressHex = bytesToHexString(ethAddress).andThen((ethAddressHex) => validateEthAddressHex(ethAddressHex));
  if (ethAddressHex.isErr()) {
    return err(ethAddressHex.error);
  }

  const blockHashHex = bytesToHexString(blockHash).andThen((blockHashHex) => validateBlockHashHex(blockHashHex));
  if (blockHashHex.isErr()) {
    return err(blockHashHex.error);
  }

  return ok({
    fid: BigNumber.from(fid),
    address: ethAddressHex.value,
    network: network,
    blockHash: blockHashHex.value,
  });
};