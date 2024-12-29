import { RemoteInfo } from "dgram";
import { GetRequestMessage, PutRequestMessage } from "./util/message-schemas";
import { Constants } from "./util/constants";
import { sendFailResponse } from "./send";
import { ReplicaState } from "./util/types";

export default function handleMessage(
  replica: ReplicaState,
  remoteInfo: RemoteInfo,
  msg: string
): void {
  console.log("Received message from:", remoteInfo.address);
  console.log(msg);
  const parsedMessage = JSON.parse(msg) as
    | GetRequestMessage
    | PutRequestMessage;
  switch (parsedMessage.type) {
    case Constants.GET: {
      handleGet(replica, parsedMessage);
      break;
    }
    case Constants.PUT: {
      handlePut(replica, parsedMessage);
      break;
    }
  }
}

function handleGet(replica: ReplicaState, msg: GetRequestMessage) {
  sendFailResponse(replica, msg);
}

function handlePut(replica: ReplicaState, msg: PutRequestMessage) {
  sendFailResponse(replica, msg);
}
