import { Command } from "commander";
import dgram from "dgram";
import { AddressInfo } from "net";

const BROADCAST = "FFFF";

type Replica = {
  targetPort: number;
  id: string;
  others: string[];
  socket: dgram.Socket;
};

const TEST_MESSAGE = { src: "me", dst: BROADCAST, leader: BROADCAST, type: "hello" };

interface ReplicaOptions {
  port: string;
  id: string;
  others: string[];
}

async function createReplica(port: number, id: string, others: string[]): Promise<Replica> {
  const socket = dgram.createSocket("udp4");
  await bindSocket(socket);
  return {
    targetPort: port,
    id: id,
    others: others,
    socket: socket,
  };
}

function sendMessage(replica: Replica, message: object): void {
  console.log("Sending message:", JSON.stringify(message));

  replica.socket.send(
    Buffer.from(JSON.stringify(message), "utf-8"),
    replica.targetPort,
    "127.0.0.1",
    (e) => {
      if (e) {
        console.log("Error on message transmission", e);
      }
      console.error(e);
    }
  );
}

function bindSocket(socket: dgram.Socket): Promise<void> {
  return new Promise((resolve) => {
    socket.bind({ address: "127.0.0.1", port: 0 });
    socket.once("listening", () => {
      const addressInfo = socket.address();
      console.log("Port assigned:", addressInfo);
      resolve();
    });
  });
}

function replicaEvents(replica: Replica): void {
  replica.socket.on("message", (msg, remoteInfo) => {
    console.log("Received message from:", remoteInfo.address);
    console.log(msg.toString("utf-8"));
  });
}

function setupArgs(): ReplicaOptions {
  const program = new Command();
  program
    .option("-p, --port <number>", "Port number")
    .option("-i, --id <string>", "Replica ID")
    .option("-o, --others <items>", "Other replica ids", [])
    .parse();
  return program.opts<ReplicaOptions>();
}

async function runReplica() {
  const argOptions = setupArgs();
  const replica = await createReplica(parseInt(argOptions.port), argOptions.id, argOptions.others);
  replicaEvents(replica);
  sendMessage(replica, TEST_MESSAGE);
}

if (require.main === module) {
  runReplica();
}
