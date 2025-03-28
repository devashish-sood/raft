import { RemoteInfo } from "dgram";
import { GetRequestMessage, PutRequestMessage } from "./util/message-schemas";
import { Constants } from "./util/constants";
import { Replica, ReplicaState, Role } from "./util/types";
import { sendFail } from "./send";

export default function handleMessage(
  replica: Replica,
  remoteInfo: RemoteInfo,
  msg: string,
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

function handleGet(replica: Replica, msg: GetRequestMessage) {
  sendFail(replica, msg);
}

function handlePut(replica: Replica, msg: PutRequestMessage) {
  sendFail(replica, msg);
}
