// src : The ID of the source of the message.
// dst : The ID of the destination of the message.
// leader : The ID of the leader, or "FFFF" if the leader’s ID is unknown.
// type : The type of the message.
// {"src": "<ID>", "dst": "<ID>", "leader": "<ID>", "type": "get", "MID": "<a unique
//   "key": "<some key>"}

import { Constants } from "./constants";
import { Command } from "./types";

type Message<T> = {
  src: string;
  dst: string;
  leader: string;
  type: T;
};

type BusinessMessage<T> = Message<T> & {
  MID: string;
};

type KeyMessage = {
  key: string;
};

type ValueMessage = {
  value: string;
};

type FailMessage = BusinessMessage<typeof Constants.FAIL>;
type OkMessage = BusinessMessage<typeof Constants.OK>;

type GetRequestMessage = BusinessMessage<typeof Constants.GET> & KeyMessage;

type GetSuccessMessage = OkMessage & ValueMessage;

type PutRequestMessage = BusinessMessage<typeof Constants.PUT> &
  KeyMessage &
  ValueMessage;

type PutSuccessMessage = OkMessage;

type ClientMessage = GetRequestMessage | PutRequestMessage;

//Raft message types
type AppendEntriesMessage = Message<typeof Constants.APPENDENTRIES> & {
  term: number;
  plogIdx: number;
  plogTerm: number;
  entries: Command[];
  lCommit: number;
};

type VoteRequestMessage = Message<typeof Constants.VOTEREQUEST> & {
  term: number;
  candidateId: string;
  llogIdx: number;
  llogTerm: number;
};

type VoteResponseMessage = Message<typeof Constants.VOTERESPONSE> & {
  term: number;
  voteGranted: boolean;
};

type ProtoMessage =
  | VoteRequestMessage
  | AppendEntriesMessage
  | VoteResponseMessage;

export {
  Message,
  FailMessage,
  GetRequestMessage,
  GetSuccessMessage,
  PutRequestMessage,
  PutSuccessMessage,
  BusinessMessage,
  AppendEntriesMessage,
  ProtoMessage,
  ClientMessage,
  VoteRequestMessage,
  VoteResponseMessage,
};
