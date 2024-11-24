import { Command } from "commander";
import dgram from "dgram";

const BROADCAST = "FFFF";

type Replica = {
  targetPort: number;
  id: string;
  others: string[];
  socket: dgram.Socket;
};

interface ReplicaOptions {
  port: string;
  id: string;
  others: string[];
}

function createReplica(port: number, id: string, others: string[]): Replica {
  const socket = dgram.createSocket("udp4");
  socket.bind({ address: "localhost", port: 0 });
  return {
    targetPort: port,
    id: id,
    others: others,
    socket: socket,
  };
}

function sendMessage(replica: Replica, message: object): void {
  console.log("Sending message: ");
  console.log(JSON.stringify(message));
  replica.socket.send(Buffer.from(JSON.stringify(message), "utf-8"), replica.targetPort);
}

function runReplica(replica: Replica): void {
  replica.socket.on("message", (msg, remoteInfo) => {
    console.log("Received message from:", remoteInfo.address);
    console.log(msg.toString("utf-8"));
  });
}

function setupArgs(): ReplicaOptions {
  const program = new Command();
  program
    .option("-p, --port <number>", "Port number", "8000")
    .option("-i, --id <string>", "Replica ID")
    .option("-o, --others <items>", "Other replica ids", [])
    .parse();
  return program.opts<ReplicaOptions>();
}

if (require.main === module) {
  const argOptions = setupArgs();
  const replica = createReplica(parseInt(argOptions.port), argOptions.id, argOptions.others);
  runReplica(replica);
}
