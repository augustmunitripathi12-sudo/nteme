const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const players = {};
const messages = [];

function cleanName(name) {
  const cleaned = String(name || "Player").trim().substring(0, 15);
  return cleaned || "Player";
}

function cleanCharacter(character) {
  return character === "blue" ? "blue" : "original";
}

function makePlayer(id) {
  return {
    id,
    x: 350,
    y: 250,
    frame: 0,
    facingLeft: false,
    currentDir: "front",
    name: "Player",
    character: "original",
    ready: false
  };
}

function snapshotPlayers() {
  return Object.fromEntries(
    Object.entries(players).map(([id, player]) => [id, { ...player }])
  );
}

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  players[socket.id] = makePlayer(socket.id);

  socket.emit("currentPlayers", snapshotPlayers());
  socket.emit("chatHistory", messages);
  socket.emit("youAre", socket.id);

  socket.broadcast.emit("playerJoined", { ...players[socket.id] });

  socket.on("setPlayerData", (data = {}) => {
    const player = players[socket.id];
    if (!player) return;

    player.name = cleanName(data.name);
    player.character = cleanCharacter(data.character);
    player.ready = true;

    io.emit("playerUpdated", { ...player });
  });

  socket.on("playerMovement", (data = {}) => {
    const player = players[socket.id];
    if (!player || !player.ready) return;

    if (Number.isFinite(data.x)) player.x = data.x;
    if (Number.isFinite(data.y)) player.y = data.y;
    if (Number.isFinite(data.frame)) player.frame = data.frame;
    if (typeof data.facingLeft === "boolean") player.facingLeft = data.facingLeft;

    if (["front", "back", "side"].includes(data.currentDir)) {
      player.currentDir = data.currentDir;
    }

    // Movement NEVER changes name or character.
    // This stops skin/name from being overwritten by old/default client values.
    socket.broadcast.volatile.emit("playerMoved", { ...player });
  });

  socket.on("chatMessage", (text) => {
    const player = players[socket.id];
    if (!player || !text) return;

    const msg = {
      id: socket.id,
      name: player.name,
      text: String(text).substring(0, 200)
    };

    messages.push(msg);

    if (messages.length > 50) {
      messages.shift();
    }

    io.emit("chatMessage", msg);
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);

    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

