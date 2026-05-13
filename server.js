const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const players = {};
const messages = [];
const MAX_MESSAGES = 50;

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  players[socket.id] = {
    id: socket.id,
    x: 350,
    y: 250,
    frame: 0,
    facingLeft: false,
    currentDir: "front",
    name: "Player",
    character: "original"
  };

  socket.emit("currentPlayers", players);
  socket.emit("chatHistory", messages);
  socket.broadcast.emit("playerJoined", players[socket.id]);

  socket.on("setPlayerData", (data) => {
    if (!players[socket.id]) return;
    const name = (data.name || "").trim();
    if (!name) return;

    players[socket.id].name = name.substring(0, 15);
    players[socket.id].character = data.character || "original";

    // Broadcast to ALL players including sender, so everyone sees the update
    io.emit("playerUpdated", players[socket.id]);
  });

  socket.on("chatMessage", (text) => {
    if (!text || !players[socket.id]) return;
    const msg = {
      id: socket.id,
      name: players[socket.id].name,
      text: text.substring(0, 200)
    };
    messages.push(msg);
    if (messages.length > MAX_MESSAGES) messages.shift();
    io.emit("chatMessage", msg);
  });

  socket.on("playerMovement", (data) => {
    if (!players[socket.id]) return;

    players[socket.id].x = data.x;
    players[socket.id].y = data.y;
    players[socket.id].frame = data.frame;
    players[socket.id].facingLeft = data.facingLeft;
    players[socket.id].currentDir = data.currentDir;

    socket.broadcast.volatile.emit("playerMoved", {
      id: socket.id,
      x: data.x,
      y: data.y,
      frame: data.frame,
      facingLeft: data.facingLeft,
      currentDir: data.currentDir
    });
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
