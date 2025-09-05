# Aave V3 SDK

JavaScript SDK for Aave V3 on Ethereum Sepolia testnet. Simulate transactions and generate transaction data for lending operations.

## Features

- Transaction simulation (supply, withdraw, borrow, repay)
- Real-time on-chain data queries
- Transaction data generation
- RPC failover with multiple providers
- Rate limit handling

## Installation

```bash
npm install
```

## Dependencies

- `ethers`: ^6.8.0
- `axios`: ^1.6.0  
- `dotenv`: ^16.3.1

## Usage

```javascript
import AaveV3SDK from './src/index.js';

const sdk = new AaveV3SDK();

// Simulate supply
const simulation = await sdk.simulateSupply(
  sdk.contracts.weth,
  ethers.parseUnits('1', 18),
  userAddress
);

// Generate transaction data
const txData = await sdk.generateSupplyTransaction(
  sdk.contracts.weth,
  ethers.parseUnits('1', 18),
  userAddress,
  0
);
```

## RPC Configuration

Create a `.env` file:

```bash
ETHEREUM_SEPOLIA_RPC=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
INFURA_API_KEY=your_infura_api_key_here
ALCHEMY_API_KEY=your_alchemy_api_key_here
```

The SDK automatically tries endpoints in order: user URL → env var → Infura → Alchemy → public RPCs.

```javascript
// Check RPC status
const status = sdk.getRpcStatus();

// Test connectivity
const connectivity = await sdk.testRpcConnectivity();

// Switch providers
sdk.switchToProvider(2);
```

## API Reference

### Constructor

```javascript
new AaveV3SDK(providerUrl)
```

- `providerUrl`: RPC endpoint URL for Ethereum Sepolia (optional, defaults to Infura)

### Simulation Methods

#### `simulateSupply(assetAddress, amount, userAddress)`
Simulates supplying assets to Aave V3.

**Returns:**
```javascript
{
  success: boolean,
  expectedATokenAmount: string,
  fee: string,
  netAmount: string,
  currentLiquidityRate: string,
  newTotalCollateral: string,
  gasEstimate: string,
  warnings: string[]
}
```

#### `simulateWithdraw(assetAddress, amount, userAddress)`
Simulates withdrawing assets from Aave V3.

**Returns:**
```javascript
{
  success: boolean,
  expectedWithdrawAmount: string,
  newTotalCollateral: string,
  newHealthFactor: string,
  currentLiquidityRate: string,
  gasEstimate: string,
  warnings: string[]
}
```

#### `simulateBorrow(assetAddress, amount, interestRateMode, userAddress)`
Simulates borrowing assets from Aave V3.

**Parameters:**
- `interestRateMode`: 1 for stable rate, 2 for variable rate

**Returns:**
```javascript
{
  success: boolean,
  expectedBorrowAmount: string,
  newTotalDebt: string,
  newHealthFactor: string,
  currentBorrowRate: string,
  interestRateMode: number,
  gasEstimate: string,
  warnings: string[]
}
```

### Transaction Data Generation

#### `generateSupplyTransaction(assetAddress, amount, onBehalfOf, referralCode)`
Generates transaction data for supplying assets.

#### `generateWithdrawTransaction(assetAddress, amount, to)`
Generates transaction data for withdrawing assets.

#### `generateBorrowTransaction(assetAddress, amount, interestRateMode, onBehalfOf, referralCode)`
Generates transaction data for borrowing assets.

**All methods return:**
```javascript
{
  to: string,           // Contract address
  data: string,         // Encoded function call
  value: string,        // ETH value (always '0x0')
  gasLimit: string,     // Estimated gas limit
  functionName: string, // Function name
  parameters: object    // Decoded parameters
}
```

### Utility Methods

#### `getUserAccountData(userAddress)`
Gets user's current account data including collateral, debt, and health factor.

#### `getReserveData(assetAddress)`
Gets current reserve data for a specific asset.

#### `getSupportedAssets()`
Returns list of supported assets for the current network.

### RPC Management Methods

#### `getRpcStatus()`
Returns current RPC configuration and status.

**Returns:**
```javascript
{
  currentEndpoint: string,    // Current RPC endpoint
  totalEndpoints: number,     // Total available endpoints
  currentIndex: number,       // Current endpoint index
  maxRetries: number,         // Maximum retry attempts
  retryDelay: number,         // Base retry delay in ms
  allEndpoints: string[]      // All available endpoints
}
```

#### `testRpcConnectivity()`
Tests connectivity to the current RPC endpoint.

**Returns:**
```javascript
{
  success: boolean,           // Connection success
  currentEndpoint: string,    // Tested endpoint
  blockNumber?: number,       // Latest block number (if successful)
  chainId?: number,          // Network chain ID (if successful)
  error?: string             // Error message (if failed)
}
```

#### `switchToProvider(index)`
Manually switch to a specific RPC endpoint by index.

**Parameters:**
- `index`: Number - Index of the RPC endpoint to switch to

**Returns:** `boolean` - True if switch was successful

#### `getRateLimitInfo()`
Get information about current rate limits and recommendations.

**Returns:**
```javascript
{
  currentEndpoint: string,    // Current RPC endpoint
  isInfura: boolean,         // Whether using Infura
  isAlchemy: boolean,        // Whether using Alchemy
  recommendations: {         // Rate limit recommendations
    infura: string[],        // Infura-specific recommendations
    alchemy: string[],       // Alchemy-specific recommendations
    general: string[]        // General recommendations
  }
}
```

## Testing

```bash
npm test
```

## Important Notes

- **Test Network Only**: This SDK is configured for Ethereum Sepolia testnet only
- **Health Factor**: Values below 1.0 indicate positions that can be liquidated
- **Interest Rates**: Use mode 1 for stable rates, mode 2 for variable rates
- **Gas Estimates**: Always verify gas estimates before executing transactions
- **Simulation First**: Always run simulations before executing actual transactions

## Contract Addresses

### Aave V3 Sepolia Deployment
- **Pool**: `0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951`
- **Pool Data Provider**: `0x41393e5e337606dc3821075Af65AeE84D7688CBD`
- **Aave Oracle**: `0x54586bE62E3c3580375aE3723C145253060Ca0C2`

## Supported Assets

### Aave V3 Sepolia Supported Tokens
- WETH: `0xDD13E55209Fd76AfE204dBda4007C227904f0a81`
- USDC: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- DAI: `0x68194a729C2450ad26072b3D33ADaCbcef39D574`

## Error Handling

All methods include proper error handling and return detailed error messages when operations fail. Always check the `success` field in simulation results before proceeding with transactions.

## License

MIT
