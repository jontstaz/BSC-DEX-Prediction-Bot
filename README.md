# DEXPredictionBot

This bot fetches the overall consensus of the 5min and 1min BNB/USDT charts based on a number of TA signals provided by Trading View. It determines if the consensus is a BUY or SELL prior to each prediction round and places the bet on PancakeSwap or CandleGenie accordingly.

## 💡 How to use

1. Edit `.env-example` with your private key and desired bet amount then rename to `.env`
2. run `npm install`
3. For PancakeSwap run `npm run start`. For CandleGenie run `npm run candle`
4. profit



#### Advice:
- Set your bet amount to no higher than 1/10th of your available BNB balance.


## Disclaimers

**Nothing contained in this program, scripts, code or repository should be construed as investment advice.**

Every time the bot wins, it donates a small portion of your winnings to the  developer of this bot so that he can have a delicious meal for dinner
All investment strategies and investments involve risk of loss.
By using this program you accept all liabilities, and that no claims can be made against the developers or others connected with the program.
Credits to Modagavr for original build. I extended the bot greatly to make it much smarter as opposed to just following/going against the trend of other bettors.
