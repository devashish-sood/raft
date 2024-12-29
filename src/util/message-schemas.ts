// src : The ID of the source of the message.
// dst : The ID of the destination of the message.
// leader : The ID of the leader, or "FFFF" if the leader’s ID is unknown.
// type : The type of the message.
// {"src": "<ID>", "dst": "<ID>", "leader": "<ID>", "type": "get", "MID": "<a unique
//   "key": "<some key>"}

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

type FailMessage = BusinessMessage<"fail">;
type OkMessage = BusinessMessage<"ok">;

type GetRequestMessage = BusinessMessage<"get"> & KeyMessage;

type GetSuccessMessage = OkMessage & ValueMessage;

type PutRequestMessage = BusinessMessage<"put"> & KeyMessage & ValueMessage;

type PutSuccessMessage = OkMessage;

type ClientMessage = GetRequestMessage | PutRequestMessage;

//Raft message types
type AppendEntriesMessage = Message<"AE"> & {
  term: number;
  plogIdx: number;
  plogTerm: number;
  entries: Command[];
  lCommit: number;
};

type VoteRequestMessage = Message<"RV"> & {
  term: number;
  candidateId: string;
  llogIdx: number;
  llogTerm: number;
};

type VoteResponseMessage = Message<"RV"> & {
  term: number;
  voteGranted: boolean;
};

type ProtoMessage = VoteRequestMessage | AppendEntriesMessage;

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
  VoteResponseMessage
};
