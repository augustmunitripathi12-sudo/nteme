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

// Serve static files from the current directory
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const players = {};
const messages = [];

// Helper to sanitize player names
function cleanName(name) {
  const cleaned = String(name || "Player").trim().substring(0, 15);
  return cleaned || "Player";
}

// Helper to validate character choice
function cleanCharacter(character) {
  return character === "blue" ? "blue" : "original";
}

// Initialize player object
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

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // 1. Create and store the new player
  players[socket.id] = makePlayer(socket.id);

  // 2. Send initial state to the new player
  socket.emit("currentPlayers", players);
  socket.emit("chatHistory", messages);
  socket.emit("youAre", socket.id);

  // 3. Inform others a generic "new player" is here
  socket.broadcast.emit("playerJoined", players[socket.id]);

  // Handle player setup (Name and Skin)
  socket.on("setPlayerData", (data = {}) => {
    const player = players[socket.id];
    if (!player) return;

    player.name = cleanName(data.name);
    player.character = cleanCharacter(data.character);
    player.ready = true;

    // Broadcast the full updated player info to everyone
    io.emit("playerUpdated", player);
  });

  // Handle Movement (Optimized with volatile)
  socket.on("playerMovement", (data = {}) => {
    const player = players[socket.id];
    if (!player || !player.ready) return;

    // Update server-side state
    if (Number.isFinite(data.x)) player.x = data.x;
    if (Number.isFinite(data.y)) player.y = data.y;
    if (Number.isFinite(data.frame)) player.frame = data.frame;
    if (typeof data.facingLeft === "boolean") player.facingLeft = data.facingLeft;
    if (["front", "back", "side"].includes(data.currentDir)) {
      player.currentDir = data.currentDir;
    }

    // Broadcast movement to all other clients. 
    // We send the ID so the client knows which player to move.
    socket.broadcast.volatile.emit("playerMoved", {
      id: socket.id,
      x: player.x,
      y: player.y,
      frame: player.frame,
      facingLeft: player.facingLeft,
      currentDir: player.currentDir
    });
  });

  // Handle Chat
  socket.on("chatMessage", (text) => {
    const player = players[socket.id];
    if (!player || !text) return;

    const msg = {
      id: socket.id,
      name: player.name,
      text: String(text).substring(0, 200)
    };

    messages.push(msg);
    if (messages.length > 50) messages.shift();

    io.emit("chatMessage", msg);
  });

  // Handle Disconnect
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
