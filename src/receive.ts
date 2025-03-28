import { RemoteInfo } from "dgram";
import { GetRequestMessage, PutRequestMessage } from "./util/message-schemas";
import { Constants } from "./util/constants";
import { ReplicaState, Role } from "./util/types";

export default function handleMessage<T extends Role>(
  replica: ReplicaState<T>,
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

function handleGet<T extends Role>(
  replica: ReplicaState<T>,
  msg: GetRequestMessage
) {
  sendFailResponse(replica, msg);
}

function handlePut<T extends Role>(
  replica: ReplicaState<T>,
  msg: PutRequestMessage
) {
  sendFailResponse(replica, msg);
}
