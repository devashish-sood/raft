// src : The ID of the source of the message.
// dst : The ID of the destination of the message.
// leader : The ID of the leader, or "FFFF" if the leader’s ID is unknown.
// type : The type of the message.
// {"src": "<ID>", "dst": "<ID>", "leader": "<ID>", "type": "get", "MID": "<a unique
//   "key": "<some key>"}

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

export {
  FailMessage,
  GetRequestMessage,
  GetSuccessMessage,
  PutRequestMessage,
  PutSuccessMessage,
  BusinessMessage,
};
