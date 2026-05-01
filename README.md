# Web3Tube

Web3Tube is a simple Web3-based video sharing project built for learning purposes.

## Features
- Connect wallet with MetaMask
- Upload video using IPFS hash
- View uploaded videos
- Like videos
- Add comments
- Store extra video metadata like thumbnail and category

## Tech Stack
- React
- JavaScript
- Solidity
- Hardhat
- Ethers.js
- Express.js
- MongoDB

## Project Structure
- `client/` - React frontend
- `contracts/` - Solidity smart contracts
- `scripts/` - Deployment and helper scripts
- `test/` - Contract test files
- `server.js` - Backend API
- `hardhat.config.js` - Hardhat configuration

## How to Run

### 1. Install dependencies
```bash
npm install
cd client
npm install
2. Compile smart contract
npm run compile
3. Start local blockchain
npm run chain:start
4. Deploy contract
npm run deploy
5. Start backend server
npm run db:start
6. Start frontend
cd client
npm start


Useful Commands
npm run compile
npm run test
npm run chain:start
npm run deploy
npm run db:start
npm run restore:videos


Notes
This is a learning project.
Video files are not stored on-chain.
The app stores video hash and related metadata.
MetaMask and Hardhat local network are used for testing.


Author
Varun Gaikwad
