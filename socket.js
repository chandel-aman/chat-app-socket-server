const { Server } = require("socket.io");
const { createServer } = require("http");
require("dotenv").config();

//logger
const logger = require("./utils/logger");

const server = createServer();
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
  },
});

const PORT = process.env.PORT;

let users = [];

io.on("connection", (socket) => {
  logger.debug("A user connected", socket.id);

  //destructuring the user id and connected users from the socket query passed by the client
  const { userId, connectedUsers } = socket.handshake.query;

  //adding the user id and socket id to the user array
  addUser(userId, socket.id);

  sendOnlineUsers(connectedUsers);

  //sending message
  socket.on("sendMessage", ({ message, recipients = [], convId }) => {
    const newRecipients = recipients.filter(
      (recipient) => recipient._id !== userId
    );

    newRecipients.forEach((recipient) => {
      users.forEach((user) => {
        if (user.userId === recipient._id) {
          socket.to(user.socketId).emit("receiveMessage", { message, convId });
        }
      });
    });
  });

  //sending a reaction for a message
  socket.on("sendReaction", ({ reaction, recipients = [], convId, msgId }) => {
    const newRecipients = recipients.filter(
      (recipient) => recipient._id !== userId
    );

    newRecipients.forEach((recipient) => {
      users.forEach((user) => {
        if (user.userId === recipient._id) {
          socket
            .to(user.socketId)
            .emit("receiveReaction", { reaction, convId, msgId });
        }
      });
    });
  });

  //sending typing state to the receiver
  socket.on("typing", ({ conversationId, userId, recipients, typingState }) => {
    if (conversationId && userId) {
      const newRecipients = recipients.filter(
        (recipient) => recipient._id !== userId
      );

      newRecipients.forEach((recipient) => {
        users.forEach((user) => {
          if (user.userId === recipient._id) {
            socket
              .to(user.socketId)
              .emit("typingDetected", { conversationId, userId, typingState });
          }
        });
      });
    }
  });

  //when a user disconnects
  socket.on("disconnect", () => {
    removeUser(socket.id);
    sendOnlineUsers(connectedUsers);
    logger.debug("User is disconnected");
  });
});

//function to add the connected users
const addUser = (userId, socketId) => {
  if (!users.some((user) => user.userId === userId))
    users.push({ userId, socketId });
};

//function to remove the disconnected users
const removeUser = (socketId) => {
  users = users.filter((user) => user.socketId !== socketId);
};

//function to send the online users to the client
const sendOnlineUsers = (connectedUsers) => {
  let userContactUserId = [];
  if (connectedUsers) {
    users.forEach((user) => {
      if (connectedUsers.includes(user.userId)) {
        userContactUserId.push(user);
      }
    });
  }
  // logger.debug(userContactUserId);
  io.emit("onlineUsers", userContactUserId);
};

server.listen(PORT, () => {
  logger.info("Listening on PORT:" + PORT);
});
