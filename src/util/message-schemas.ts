// src : The ID of the source of the message.
// dst : The ID of the destination of the message.
// leader : The ID of the leader, or "FFFF" if the leader’s ID is unknown.
// interface : The interface of the message.
// {"src": "<ID>", "dst": "<ID>", "leader": "<ID> .  ", "interface": "get", "MID": "<a unique
//   "key": "<some key>"}

import { Constants } from "./constants";
import { Command } from "./types";

type MessageType =
  | typeof Constants.GET
  | typeof Constants.PUT
  | typeof Constants.APPENDENTRIES
  | typeof Constants.VOTEREQUEST
  | typeof Constants.VOTERESPONSE
  | typeof Constants.OK
  | typeof Constants.FAIL
  | typeof Constants.REDIRECT
  | typeof Constants.HELLO;

interface Message<T extends MessageType> {
  src: string;
  dst: string;
  leader: string | undefined;
  type: T;
}

interface DataMessage<T extends MessageType> extends Message<T> {
  MID: string;
}

interface KeyMessage {
  key: string;
}

interface ValueMessage {
  value: string;
}

interface FailMessage extends DataMessage<typeof Constants.FAIL> {}
interface OkMessage extends DataMessage<typeof Constants.OK> {}

interface GetRequestMessage
  extends DataMessage<typeof Constants.GET>,
    KeyMessage {}

interface GetSuccessMessage extends OkMessage, ValueMessage {}

interface PutRequestMessage
  extends DataMessage<typeof Constants.PUT>,
    KeyMessage,
    ValueMessage {}

interface PutSuccessMessage extends OkMessage {}

type BusinessMessage =
  | GetRequestMessage
  | PutRequestMessage
  | GetSuccessMessage
  | PutSuccessMessage;

//Raft message interfaces
interface AppendEntriesMessage extends Message<typeof Constants.APPENDENTRIES> {
  term: number;
  plogIdx: number;
  plogTerm: number;
  entries: Command[];
  lCommit: number;
}

interface VoteRequestMessage extends Message<typeof Constants.VOTEREQUEST> {
  term: number;
  candidateId: string;
  llogIdx: number;
  llogTerm: number;
}

interface VoteResponseMessage extends Message<typeof Constants.VOTERESPONSE> {
  term: number;
  voteGranted: boolean;
}

type ProtoMessage =
  | VoteRequestMessage
  | AppendEntriesMessage
  | VoteResponseMessage;

export {
  MessageType,
  Message,
  FailMessage,
  GetRequestMessage,
  GetSuccessMessage,
  PutRequestMessage,
  PutSuccessMessage,
  BusinessMessage,
  AppendEntriesMessage,
  ProtoMessage,
  VoteRequestMessage,
  VoteResponseMessage,
};
