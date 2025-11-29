# Watch Together (wash2gather)

A real-time web application that allows users to watch YouTube videos together and chat in real-time. Built with Node.js, Express, and Socket.io.

## Features

- **Real-time Video Synchronization**: Watch YouTube videos in sync with friends.
- **Instant Messaging**: Chat with others in the room while watching.
- **Room-based System**: Create or join rooms to have private watch parties.
- **WebRTC Support**: Uses WebRTC for peer-to-peer data exchange (with Socket.io fallback).

## Tech Stack

- **Backend**: Node.js, Express, Socket.io
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Real-time Communication**: Socket.io, WebRTC

## Prerequisites

Before you begin, ensure you have met the following requirements:

- **Node.js**: You need to have Node.js installed on your machine. You can download it from [nodejs.org](https://nodejs.org/).

## Installation

1.  **Clone the repository:**

    ```bash
    git clone <repository-url>
    cd wash2gather
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

## Usage

1.  **Start the server:**

    ```bash
    npm start
    ```

2.  **Access the application:**

    Open your web browser and navigate to `http://localhost:3000`.

3.  **How to use:**
    - Enter a YouTube video URL in the input field.
    - Click "Load Video" to load it.
    - Share the room link or ID with your friends (implementation detail depends on how rooms are shared in the UI).
    - Use the chat box to send messages.

## Deployment

This application is set up for easy deployment on **Render**.

See [DEPLOY.md](DEPLOY.md) for detailed deployment instructions.

## License

This project is licensed under the ISC License.
