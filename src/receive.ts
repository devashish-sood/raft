import { RemoteInfo } from "dgram";
import { RaftStore, Replica } from "./util/types";
import { GetRequestMessage, PutRequestMessage } from "./util/message-schemas";
import { Constants } from "./util/constants";
import { sendFailResponse } from "./send";

export default function handleMessage(
  replica: Replica,
  remoteInfo: RemoteInfo,
  msg: string,
  store: RaftStore
): void {
  console.log("Received message from:", remoteInfo.address);
  console.log(msg);
  const parsedMessage = JSON.parse(msg) as
    | GetRequestMessage
    | PutRequestMessage;
  switch (parsedMessage.type) {
    case Constants.GET: {
      handleGet(replica, parsedMessage, store);
      break;
    }
    case Constants.PUT: {
      handlePut(replica, parsedMessage, store);
      break;
    }
  }
}

function handleGet(replica: Replica, msg: GetRequestMessage, store: RaftStore) {
  sendFailResponse(replica, msg);
}

function handlePut(replica: Replica, msg: PutRequestMessage, store: RaftStore) {
  sendFailResponse(replica, msg);
}
