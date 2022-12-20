import { faker } from '@faker-js/faker';
import { PeerId } from '@libp2p/interface-peer-id';
import { createEd25519PeerId } from '@libp2p/peer-id-factory';
import * as ed from '@noble/ed25519';
import { blake3 } from '@noble/hashes/blake3';
import { ethers, utils, Wallet } from 'ethers';
import { arrayify } from 'ethers/lib/utils';
import { Factory } from 'fishery';
import { Builder, ByteBuffer } from 'flatbuffers';
import { NETWORK_TOPIC_PRIMARY } from '~/network/p2p/protocol';
import MessageModel from '~/storage/flatbuffers/messageModel';
import { VerificationEthAddressClaim } from '~/storage/flatbuffers/types';
import { toFarcasterTime } from '~/storage/flatbuffers/utils';
import { KeyPair } from '~/types';
import { generateEd25519KeyPair } from '~/utils/crypto';
import { signMessageHash, signVerificationEthAddressClaim } from '~/utils/eip712';
import {
  ContactInfoContentT,
  ContactInfoContent,
  GossipContent,
  GossipMessage,
  GossipMessageT,
  GossipAddressInfoT,
  GossipAddressInfo,
} from '~/utils/generated/gossip_generated';
import { IdRegistryEvent, IdRegistryEventT, IdRegistryEventType } from '~/utils/generated/id_registry_event_generated';
import {
  CastAddBody,
  CastAddBodyT,
  CastId,
  CastIdT,
  CastRemoveBody,
  CastRemoveBodyT,
  FarcasterNetwork,
  AmpBody,
  AmpBodyT,
  HashScheme,
  Message,
  MessageBody,
  MessageData,
  MessageDataT,
  MessageT,
  MessageType,
  ReactionBody,
  ReactionBodyT,
  ReactionType,
  SignatureScheme,
  SignerBody,
  SignerBodyT,
  UserDataBody,
  UserDataBodyT,
  UserDataType,
  UserId,
  UserIdT,
  VerificationAddEthAddressBody,
  VerificationAddEthAddressBodyT,
  VerificationRemoveBody,
  VerificationRemoveBodyT,
} from '~/utils/generated/message_generated';
import {
  NameRegistryEvent,
  NameRegistryEventT,
  NameRegistryEventType,
} from '~/utils/generated/name_registry_event_generated';

/* eslint-disable security/detect-object-injection */
const BytesFactory = Factory.define<Uint8Array, { length?: number }>(({ transientParams }) => {
  const length = transientParams.length ?? 8;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < bytes.byteLength; i++) {
    bytes[i] = faker.datatype.number({ max: 255, min: 0 });
  }
  return bytes;
});

const FIDFactory = Factory.define<Uint8Array, { fid?: number }>(({ transientParams }) => {
  const builder = new Builder(4);
  const fid = transientParams.fid ?? faker.datatype.number({ max: 2 ** 32 - 1 });
  builder.addInt32(fid);
  return builder.asUint8Array();
});

const FnameFactory = Factory.define<Uint8Array>(() => {
  const builder = new Builder(8);
  // Add 8 random alphabets as the fname
  for (let i = 0; i < 8; i++) {
    builder.addInt8(faker.datatype.number({ min: 65, max: 90 }));
  }
  return builder.asUint8Array();
});

const TsHashFactory = Factory.define<Uint8Array, { timestamp?: number; hash?: Uint8Array }>(({ transientParams }) => {
  return MessageModel.tsHash(
    transientParams.timestamp ?? faker.date.recent().getTime(),
    transientParams.hash ?? blake3(faker.random.alphaNumeric(256), { dkLen: 16 })
  );
});

const UserIdFactory = Factory.define<UserIdT, any, UserId>(({ onCreate }) => {
  onCreate((params) => {
    const builder = new Builder(1);
    builder.finish(params.pack(builder));
    return UserId.getRootAsUserId(new ByteBuffer(builder.asUint8Array()));
  });

  return new UserIdT(Array.from(FIDFactory.build()));
});

const CastIdFactory = Factory.define<CastIdT, any, CastId>(({ onCreate }) => {
  onCreate((params) => {
    const builder = new Builder(1);
    builder.finish(params.pack(builder));
    return CastId.getRootAsCastId(new ByteBuffer(builder.asUint8Array()));
  });

  return new CastIdT(Array.from(FIDFactory.build()), Array.from(TsHashFactory.build()));
});

const MessageDataFactory = Factory.define<MessageDataT, any, MessageData>(({ onCreate }) => {
  onCreate((params) => {
    const builder = new Builder(1);
    builder.finish(params.pack(builder));
    return MessageData.getRootAsMessageData(new ByteBuffer(builder.asUint8Array()));
  });

  return new MessageDataT(
    MessageBody.CastAddBody,
    CastAddBodyFactory.build(),
    MessageType.CastAdd,
    toFarcasterTime(faker.date.recent().getTime()),
    Array.from(FIDFactory.build()),
    FarcasterNetwork.Testnet
  );
});

const CastAddBodyFactory = Factory.define<CastAddBodyT, any, CastAddBody>(({ onCreate }) => {
  onCreate((params) => {
    const builder = new Builder(1);
    builder.finish(params.pack(builder));
    return CastAddBody.getRootAsCastAddBody(new ByteBuffer(builder.asUint8Array()));
  });

  return new CastAddBodyT(
    [faker.internet.url(), faker.internet.url()],
    [UserIdFactory.build(), UserIdFactory.build(), UserIdFactory.build()],
    CastIdFactory.build(),
    faker.lorem.sentence(4)
  );
});

const CastAddDataFactory = Factory.define<MessageDataT, any, MessageData>(({ onCreate }) => {
  onCreate((params) => {
    return MessageDataFactory.create(params);
  });

  return MessageDataFactory.build({
    bodyType: MessageBody.CastAddBody,
    body: CastAddBodyFactory.build(),
    type: MessageType.CastAdd,
  });
});

const CastRemoveBodyFactory = Factory.define<CastRemoveBodyT, any, CastRemoveBody>(({ onCreate }) => {
  onCreate((params) => {
    const builder = new Builder(1);
    builder.finish(params.pack(builder));
    return CastRemoveBody.getRootAsCastRemoveBody(new ByteBuffer(builder.asUint8Array()));
  });

  return new CastRemoveBodyT(Array.from(TsHashFactory.build()));
});

const CastRemoveDataFactory = Factory.define<MessageDataT, any, MessageData>(({ onCreate }) => {
  onCreate((params) => {
    return MessageDataFactory.create(params);
  });

  return MessageDataFactory.build({
    bodyType: MessageBody.CastRemoveBody,
    body: CastRemoveBodyFactory.build(),
    type: MessageType.CastRemove,
  });
});

const AmpBodyFactory = Factory.define<AmpBodyT, any, AmpBody>(({ onCreate }) => {
  onCreate((params) => {
    const builder = new Builder(1);
    builder.finish(params.pack(builder));
    return AmpBody.getRootAsAmpBody(new ByteBuffer(builder.asUint8Array()));
  });

  return new AmpBodyT(UserIdFactory.build());
});

const AmpAddDataFactory = Factory.define<MessageDataT, any, MessageData>(({ onCreate }) => {
  onCreate((params) => {
    return MessageDataFactory.create(params);
  });

  return MessageDataFactory.build({
    bodyType: MessageBody.AmpBody,
    body: AmpBodyFactory.build(),
    type: MessageType.AmpAdd,
  });
});

const AmpRemoveDataFactory = Factory.define<MessageDataT, any, MessageData>(({ onCreate }) => {
  onCreate((params) => {
    return MessageDataFactory.create(params);
  });

  return MessageDataFactory.build({
    bodyType: MessageBody.AmpBody,
    body: AmpBodyFactory.build(),
    type: MessageType.AmpRemove,
  });
});

const ReactionBodyFactory = Factory.define<ReactionBodyT, any, ReactionBody>(({ onCreate }) => {
  onCreate((params) => {
    const builder = new Builder(1);
    builder.finish(params.pack(builder));
    return ReactionBody.getRootAsReactionBody(new ByteBuffer(builder.asUint8Array()));
  });

  return new ReactionBodyT(CastIdFactory.build(), ReactionType.Like);
});

const ReactionAddDataFactory = Factory.define<MessageDataT, any, MessageData>(({ onCreate }) => {
  onCreate((params) => {
    return MessageDataFactory.create(params);
  });

  return MessageDataFactory.build({
    bodyType: MessageBody.ReactionBody,
    body: ReactionBodyFactory.build(),
    type: MessageType.ReactionAdd,
  });
});

const ReactionRemoveDataFactory = Factory.define<MessageDataT, any, MessageData>(({ onCreate }) => {
  onCreate((params) => {
    return MessageDataFactory.create(params);
  });

  return MessageDataFactory.build({
    bodyType: MessageBody.ReactionBody,
    body: ReactionBodyFactory.build(),
    type: MessageType.ReactionRemove,
  });
});

const VerificationAddEthAddressBodyFactory = Factory.define<
  VerificationAddEthAddressBodyT,
  { wallet?: ethers.Wallet; fid?: Uint8Array; network?: FarcasterNetwork },
  VerificationAddEthAddressBody
>(({ onCreate, transientParams }) => {
  onCreate(async (params) => {
    // Generate address and signature
    const wallet = transientParams.wallet ?? new Wallet(utils.randomBytes(32));
    params.address = Array.from(arrayify(wallet.address));

    const fid = transientParams.fid ?? FIDFactory.build();
    const claim: VerificationEthAddressClaim = {
      fid,
      address: wallet.address,
      network: transientParams.network ?? FarcasterNetwork.Testnet,
      blockHash: Uint8Array.from(params.blockHash),
    };
    const signature = await signVerificationEthAddressClaim(claim, wallet);
    params.ethSignature = Array.from(arrayify(signature));

    const builder = new Builder(1);
    builder.finish(params.pack(builder));
    return VerificationAddEthAddressBody.getRootAsVerificationAddEthAddressBody(new ByteBuffer(builder.asUint8Array()));
  });

  return new VerificationAddEthAddressBodyT(
    Array.from(arrayify(faker.datatype.hexadecimal({ length: 40 }))),
    Array.from(arrayify(faker.datatype.hexadecimal({ length: 130 }))),
    Array.from(arrayify(faker.datatype.hexadecimal({ length: 64 })))
  );
});

const VerificationAddEthAddressDataFactory = Factory.define<MessageDataT, any, MessageData>(({ onCreate }) => {
  onCreate((params) => {
    return MessageDataFactory.create(params);
  });

  return MessageDataFactory.build({
    bodyType: MessageBody.VerificationAddEthAddressBody,
    body: VerificationAddEthAddressBodyFactory.build(),
    type: MessageType.VerificationAddEthAddress,
  });
});

const VerificationRemoveBodyFactory = Factory.define<VerificationRemoveBodyT, any, VerificationRemoveBody>(
  ({ onCreate }) => {
    onCreate((params) => {
      const builder = new Builder(1);
      builder.finish(params.pack(builder));
      return VerificationRemoveBody.getRootAsVerificationRemoveBody(new ByteBuffer(builder.asUint8Array()));
    });

    return new VerificationRemoveBodyT(Array.from(arrayify(faker.datatype.hexadecimal({ length: 40 }))));
  }
);

const VerificationRemoveDataFactory = Factory.define<MessageDataT, any, MessageData>(({ onCreate }) => {
  onCreate((params) => {
    return MessageDataFactory.create(params);
  });

  return MessageDataFactory.build({
    bodyType: MessageBody.VerificationRemoveBody,
    body: VerificationRemoveBodyFactory.build(),
    type: MessageType.VerificationRemove,
  });
});

const SignerBodyFactory = Factory.define<SignerBodyT, any, SignerBody>(({ onCreate }) => {
  onCreate((params) => {
    const builder = new Builder(1);
    builder.finish(params.pack(builder));
    return SignerBody.getRootAsSignerBody(new ByteBuffer(builder.asUint8Array()));
  });

  return new SignerBodyT(Array.from(arrayify(faker.datatype.hexadecimal({ length: 64 }))));
});

const SignerAddDataFactory = Factory.define<MessageDataT, any, MessageData>(({ onCreate }) => {
  onCreate((params) => {
    return MessageDataFactory.create(params);
  });

  return MessageDataFactory.build({
    bodyType: MessageBody.SignerBody,
    body: SignerBodyFactory.build(),
    type: MessageType.SignerAdd,
  });
});

const SignerRemoveDataFactory = Factory.define<MessageDataT, any, MessageData>(({ onCreate }) => {
  onCreate((params) => {
    return MessageDataFactory.create(params);
  });

  return MessageDataFactory.build({
    bodyType: MessageBody.SignerBody,
    body: SignerBodyFactory.build(),
    type: MessageType.SignerRemove,
  });
});

const UserDataBodyFactory = Factory.define<UserDataBodyT, any, UserDataBody>(({ onCreate }) => {
  onCreate((params) => {
    const builder = new Builder(1);
    builder.finish(params.pack(builder));
    return UserDataBody.getRootAsUserDataBody(new ByteBuffer(builder.asUint8Array()));
  });

  return new UserDataBodyT(UserDataType.Pfp, faker.random.alphaNumeric(32));
});

const UserDataAddDataFactory = Factory.define<MessageDataT, any, MessageData>(({ onCreate }) => {
  onCreate((params) => {
    return MessageDataFactory.create(params);
  });

  return MessageDataFactory.build({
    bodyType: MessageBody.UserDataBody,
    body: UserDataBodyFactory.build(),
    type: MessageType.UserDataAdd,
  });
});

const MessageFactory = Factory.define<MessageT, { signer?: KeyPair; wallet?: Wallet }, Message>(
  ({ onCreate, transientParams }) => {
    onCreate(async (params) => {
      // Generate hash
      if (params.hash.length === 0) {
        params.hash = Array.from(blake3(new Uint8Array(params.data), { dkLen: 16 }));
      }

      // Generate signature
      if (params.signature.length === 0) {
        if (transientParams.signer) {
          const signer = transientParams.signer;
          params.signature = Array.from(await ed.sign(new Uint8Array(params.hash), signer.privateKey));
          params.signer = Array.from(signer.publicKey);
        } else if (transientParams.wallet) {
          params.signature = Array.from(await signMessageHash(new Uint8Array(params.hash), transientParams.wallet));
          params.signatureScheme = SignatureScheme.Eip712;
          params.signer = Array.from(arrayify(transientParams.wallet.address));
        } else {
          const signer = await generateEd25519KeyPair();
          params.signature = Array.from(await ed.sign(new Uint8Array(params.hash), signer.privateKey));
          params.signer = Array.from(signer.publicKey);
        }
      }

      const builder = new Builder(1);
      builder.finish(params.pack(builder));
      return Message.getRootAsMessage(new ByteBuffer(builder.asUint8Array()));
    });

    const data = MessageDataFactory.build();
    const builder = new Builder(1);
    builder.finish(data.pack(builder));

    return new MessageT(Array.from(builder.asUint8Array()), [], HashScheme.Blake3, [], SignatureScheme.Ed25519, []);
  }
);

const IdRegistryEventFactory = Factory.define<IdRegistryEventT, any, IdRegistryEvent>(({ onCreate }) => {
  onCreate((params) => {
    const builder = new Builder(1);
    builder.finish(params.pack(builder));
    return IdRegistryEvent.getRootAsIdRegistryEvent(new ByteBuffer(builder.asUint8Array()));
  });

  return new IdRegistryEventT(
    faker.datatype.number({ max: 100000 }),
    Array.from(arrayify(faker.datatype.hexadecimal({ length: 64 }))),
    Array.from(arrayify(faker.datatype.hexadecimal({ length: 64 }))),
    faker.datatype.number({ max: 1000 }),
    Array.from(FIDFactory.build()),
    Array.from(arrayify(faker.datatype.hexadecimal({ length: 40 }))),
    IdRegistryEventType.IdRegistryRegister,
    Array.from(arrayify(faker.datatype.hexadecimal({ length: 40 })))
  );
});

const NameRegistryEventFactory = Factory.define<NameRegistryEventT, any, NameRegistryEvent>(({ onCreate }) => {
  onCreate((params) => {
    const builder = new Builder(1);
    builder.finish(params.pack(builder));
    return NameRegistryEvent.getRootAsNameRegistryEvent(new ByteBuffer(builder.asUint8Array()));
  });

  return new NameRegistryEventT(
    faker.datatype.number({ max: 100000 }),
    Array.from(arrayify(faker.datatype.hexadecimal({ length: 64 }))),
    Array.from(arrayify(faker.datatype.hexadecimal({ length: 64 }))),
    faker.datatype.number({ max: 1000 }),
    Array.from(FnameFactory.build()),
    Array.from(arrayify(faker.datatype.hexadecimal({ length: 40 }))),
    Array.from(arrayify(faker.datatype.hexadecimal({ length: 40 }))),
    NameRegistryEventType.NameRegistryTransfer
  );
});

const GossipAddressInfoFactory = Factory.define<GossipAddressInfoT, any, GossipAddressInfo>(({ onCreate }) => {
  onCreate((params) => {
    const builder = new Builder(1);
    builder.finish(params.pack(builder));
    return GossipAddressInfo.getRootAsGossipAddressInfo(new ByteBuffer(builder.asUint8Array()));
  });

  return new GossipAddressInfoT('0.0.0.0', 4, 0);
});

const ContactInfoContentFactory = Factory.define<ContactInfoContentT, { peerId?: PeerId }, ContactInfoContent>(
  ({ onCreate, transientParams }) => {
    onCreate(async (params) => {
      if (params.peerId.length == 0) {
        params.peerId = transientParams.peerId
          ? Array.from(transientParams.peerId.toBytes())
          : Array.from((await createEd25519PeerId()).toBytes());
      }

      const builder = new Builder(1);
      builder.finish(params.pack(builder));
      return ContactInfoContent.getRootAsContactInfoContent(new ByteBuffer(builder.asUint8Array()));
    });

    return new ContactInfoContentT();
  }
);

const GossipMessageFactory = Factory.define<GossipMessageT, any, GossipMessage>(({ onCreate }) => {
  onCreate((params) => {
    const builder = new Builder(1);
    builder.finish(params.pack(builder));
    return GossipMessage.getRootAsGossipMessage(new ByteBuffer(builder.asUint8Array()));
  });

  return new GossipMessageT(GossipContent.Message, MessageFactory.build(), [NETWORK_TOPIC_PRIMARY]);
});

const Factories = {
  Bytes: BytesFactory,
  FID: FIDFactory,
  Fname: FnameFactory,
  TsHash: TsHashFactory,
  UserId: UserIdFactory,
  CastId: CastIdFactory,
  ReactionBody: ReactionBodyFactory,
  ReactionAddData: ReactionAddDataFactory,
  ReactionRemoveData: ReactionRemoveDataFactory,
  CastAddBody: CastAddBodyFactory,
  CastRemoveBody: CastRemoveBodyFactory,
  MessageData: MessageDataFactory,
  CastAddData: CastAddDataFactory,
  CastRemoveData: CastRemoveDataFactory,
  AmpBody: AmpBodyFactory,
  AmpAddData: AmpAddDataFactory,
  AmpRemoveData: AmpRemoveDataFactory,
  VerificationAddEthAddressBody: VerificationAddEthAddressBodyFactory,
  VerificationAddEthAddressData: VerificationAddEthAddressDataFactory,
  VerificationRemoveBody: VerificationRemoveBodyFactory,
  VerificationRemoveData: VerificationRemoveDataFactory,
  SignerBody: SignerBodyFactory,
  SignerAddData: SignerAddDataFactory,
  SignerRemoveData: SignerRemoveDataFactory,
  UserDataBody: UserDataBodyFactory,
  UserDataAddData: UserDataAddDataFactory,
  Message: MessageFactory,
  IdRegistryEvent: IdRegistryEventFactory,
  NameRegistryEvent: NameRegistryEventFactory,
  GossipMessage: GossipMessageFactory,
  GossipContactInfoContent: ContactInfoContentFactory,
  GossipAddressInfo: GossipAddressInfoFactory,
};

export default Factories;
