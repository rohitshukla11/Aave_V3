import AaveV3SDK from '../src/index.js';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

async function runTest() {
  console.log('🚀 Aave V3 SDK Test\n');
  
  const sdk = new AaveV3SDK();
  const userAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
  
  let checksummedAddress;
  try {
    checksummedAddress = ethers.getAddress(userAddress);
  } catch (error) {
    checksummedAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
  }
  
  console.log('📊 Supported Assets:');
  const assets = sdk.getSupportedAssets();
  Object.entries(assets).forEach(([address, info]) => {
    console.log(`  ${info.symbol} (${info.name}): ${address}`);
  });
  
  console.log('\n🔍 Getting User Account Data:');
  try {
    const userData = await sdk.getUserAccountData(checksummedAddress);
    console.log(`  Total Collateral (ETH): ${ethers.formatEther(userData.totalCollateralETH)}`);
    console.log(`  Total Debt (ETH): ${ethers.formatEther(userData.totalDebtETH)}`);
    console.log(`  Available Borrows (ETH): ${ethers.formatEther(userData.availableBorrowsETH)}`);
    console.log(`  Health Factor: ${ethers.formatEther(userData.healthFactor)}`);
  } catch (error) {
    console.log(`  Error: ${error.message}`);
  }
  
  console.log('\n💰 Simulating Supply Transaction:');
  const supplyAmount = sdk.parseAmount('1', sdk.contracts.weth);
  const supplySimulation = await sdk.simulateSupply(
    sdk.contracts.weth,
    supplyAmount,
    checksummedAddress
  );
  
  if (supplySimulation.success) {
    console.log(`  ✅ Supply simulation successful`);
    console.log(`  Expected aToken Amount: ${sdk.formatAmount(supplySimulation.expectedATokenAmount, sdk.contracts.weth)}`);
    console.log(`  Fee: ${sdk.formatAmount(supplySimulation.fee, sdk.contracts.weth)}`);
    console.log(`  Net Amount: ${sdk.formatAmount(supplySimulation.netAmount, sdk.contracts.weth)}`);
    console.log(`  Gas Estimate: ${supplySimulation.gasEstimate}`);
  } else {
    console.log(`  ❌ Supply simulation failed: ${supplySimulation.error}`);
  }
  
  console.log('\n💸 Simulating Withdraw Transaction:');
  const withdrawAmount = sdk.parseAmount('0.5', sdk.contracts.weth);
  const withdrawSimulation = await sdk.simulateWithdraw(
    sdk.contracts.weth,
    withdrawAmount,
    checksummedAddress
  );
  
  if (withdrawSimulation.success) {
    console.log(`  ✅ Withdraw simulation successful`);
    console.log(`  Expected Withdraw Amount: ${sdk.formatAmount(withdrawSimulation.expectedWithdrawAmount, sdk.contracts.weth)}`);
    console.log(`  New Total Collateral: ${withdrawSimulation.newTotalCollateral} ETH`);
    console.log(`  New Health Factor: ${withdrawSimulation.newHealthFactor}`);
    console.log(`  Gas Estimate: ${withdrawSimulation.gasEstimate}`);
    if (withdrawSimulation.warnings.length > 0) {
      console.log(`  ⚠️  Warnings: ${withdrawSimulation.warnings.join(', ')}`);
    }
  } else {
    console.log(`  ❌ Withdraw simulation failed: ${withdrawSimulation.error}`);
  }
  
  console.log('\n🏦 Simulating Borrow Transaction:');
  const borrowAmount = sdk.parseAmount('100', sdk.contracts.usdc);
  const borrowSimulation = await sdk.simulateBorrow(
    sdk.contracts.usdc,
    borrowAmount,
    2,
    checksummedAddress
  );
  
  if (borrowSimulation.success) {
    console.log(`  ✅ Borrow simulation successful`);
    console.log(`  Expected Borrow Amount: ${sdk.formatAmount(borrowSimulation.expectedBorrowAmount, sdk.contracts.usdc)}`);
    console.log(`  New Total Debt: ${borrowSimulation.newTotalDebt} ETH`);
    console.log(`  New Health Factor: ${borrowSimulation.newHealthFactor}`);
    console.log(`  Current Borrow Rate: ${ethers.formatEther(borrowSimulation.currentBorrowRate)}`);
    console.log(`  Gas Estimate: ${borrowSimulation.gasEstimate}`);
    if (borrowSimulation.warnings.length > 0) {
      console.log(`  ⚠️  Warnings: ${borrowSimulation.warnings.join(', ')}`);
    }
  } else {
    console.log(`  ❌ Borrow simulation failed: ${borrowSimulation.error}`);
  }
  
  console.log('\n💳 Simulating Repay Transaction:');
  const repayAmount = sdk.parseAmount('50', sdk.contracts.usdc);
  const repaySimulation = await sdk.simulateRepay(
    sdk.contracts.usdc,
    '50',
    2,
    checksummedAddress
  );
  
  if (repaySimulation.success) {
    console.log(`  ✅ Repay simulation successful`);
    console.log(`  Expected Repay Amount: ${sdk.formatAmount(repaySimulation.expectedRepayAmount, sdk.contracts.usdc)}`);
    console.log(`  New Total Debt: ${repaySimulation.newTotalDebt} ETH`);
    console.log(`  New Health Factor: ${repaySimulation.newHealthFactor}`);
    console.log(`  Current Borrow Rate: ${ethers.formatEther(repaySimulation.currentBorrowRate)}`);
    console.log(`  Gas Estimate: ${repaySimulation.gasEstimate}`);
    if (repaySimulation.warnings.length > 0) {
      console.log(`  ⚠️  Warnings: ${repaySimulation.warnings.join(', ')}`);
    }
  } else {
    console.log(`  ❌ Repay simulation failed: ${repaySimulation.error}`);
  }
  
  console.log('\n📝 Generating Transaction Data:');
  
  const supplyTxData = await sdk.generateSupplyTransaction(
    sdk.contracts.weth,
    '1',
    checksummedAddress,
    0
  );
  console.log('\n  Supply Transaction Data:');
  console.log(`    To: ${supplyTxData.to}`);
  console.log(`    Data: ${supplyTxData.data}`);
  console.log(`    Gas Limit: ${supplyTxData.gasLimit}`);
  console.log(`    Function: ${supplyTxData.functionName}`);
  
  const withdrawTxData = await sdk.generateWithdrawTransaction(
    sdk.contracts.weth,
    '0.5',
    checksummedAddress
  );
  console.log('\n  Withdraw Transaction Data:');
  console.log(`    To: ${withdrawTxData.to}`);
  console.log(`    Data: ${withdrawTxData.data}`);
  console.log(`    Gas Limit: ${withdrawTxData.gasLimit}`);
  console.log(`    Function: ${withdrawTxData.functionName}`);
  
  const borrowTxData = await sdk.generateBorrowTransaction(
    sdk.contracts.usdc,
    '100',
    2,
    checksummedAddress,
    0
  );
  console.log('\n  Borrow Transaction Data:');
  console.log(`    To: ${borrowTxData.to}`);
  console.log(`    Data: ${borrowTxData.data}`);
  console.log(`    Gas Limit: ${borrowTxData.gasLimit}`);
  console.log(`    Function: ${borrowTxData.functionName}`);
  
  const repayTxData = await sdk.generateRepayTransaction(
    sdk.contracts.usdc,
    '50',
    2,
    checksummedAddress
  );
  console.log('\n  Repay Transaction Data:');
  console.log(`    To: ${repayTxData.to}`);
  console.log(`    Data: ${repayTxData.data}`);
  console.log(`    Gas Limit: ${repayTxData.gasLimit}`);
  console.log(`    Function: ${repayTxData.functionName}`);
  
  console.log('\n✨ Test completed!');
}

runTest().catch(console.error);
