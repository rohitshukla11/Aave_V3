import { ethers, getAddress } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

class AaveV3SDK {
  constructor(providerUrl = null) {
    this.chainId = 11155111;
    this.contracts = this.getContractAddresses();
    this.abi = this.getPoolABI();
    
    this.rpcEndpoints = this.getRpcEndpoints(providerUrl);
    this.currentProviderIndex = 0;
    this.provider = null;
    this.maxRetries = 3;
    this.retryDelay = 1000;
    
    this.initializeProvider();
    this.MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
  }

  getRpcEndpoints(providerUrl = null) {
    const endpoints = [];
    
    if (providerUrl) {
      endpoints.push(providerUrl);
    }
    
    if (process.env.ETHEREUM_SEPOLIA_RPC) {
      endpoints.push(process.env.ETHEREUM_SEPOLIA_RPC);
    }
    
    if (process.env.INFURA_API_KEY) {
      endpoints.push(`https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`);
    }
    
    if (process.env.ALCHEMY_API_KEY) {
      endpoints.push(`https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
    }
    
    // fallbacks
    endpoints.push(
      'https://rpc.sepolia.org',
      'https://sepolia.drpc.org',
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://sepolia.gateway.tenderly.co'
    );
    
    return endpoints;
  }

  initializeProvider() {
    if (this.rpcEndpoints.length === 0) {
      throw new Error('No RPC endpoints available');
    }
    
    this.provider = new ethers.JsonRpcProvider(this.rpcEndpoints[this.currentProviderIndex]);
    this.poolContract = new ethers.Contract(this.contracts.pool, this.abi, this.provider);
  }

  switchToNextProvider() {
    this.currentProviderIndex = (this.currentProviderIndex + 1) % this.rpcEndpoints.length;
    console.warn(`Switching to RPC endpoint: ${this.rpcEndpoints[this.currentProviderIndex]}`);
    this.initializeProvider();
  }

  async executeWithFailover(operation, ...args) {
    let lastError = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await operation.apply(this, args);
        return result;
      } catch (error) {
        lastError = error;
        
        const isRpcError = this.isRpcError(error);
        
        if (isRpcError && attempt < this.maxRetries - 1) {
          console.warn(`RPC call failed (attempt ${attempt + 1}/${this.maxRetries}): ${error.message}`);
          
          const isRateLimit = error.message.toLowerCase().includes('too many requests') || 
                             error.message.toLowerCase().includes('rate limit') ||
                             error.message.toLowerCase().includes('quota exceeded');
          
          this.switchToNextProvider();
          
          let delay = this.retryDelay * Math.pow(2, attempt);
          if (isRateLimit) {
            delay = Math.max(delay, 5000);
            console.warn(`⏳ Rate limit detected, waiting ${delay}ms before retry...`);
          }
          
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError;
  }

  isRpcError(error) {
    const rpcErrorPatterns = [
      '522', '503', '502', '504',
      'timeout', 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT',
      'network', 'fetch', 'connection',
      'server response 522',
      'JsonRpcProvider failed to detect network',
      'too many requests', 'rate limit', 'quota exceeded',
      'bad_data', 'missing response for request'
    ];
    
    const gasEstimationErrors = [
      'missing revert data',
      'execution reverted',
      'require(false)'
    ];
    
    const errorMessage = error.message.toLowerCase();
    const isGasError = gasEstimationErrors.some(pattern => errorMessage.includes(pattern));
    
    const isRateLimit = errorMessage.includes('too many requests') || 
                       errorMessage.includes('rate limit') ||
                       errorMessage.includes('quota exceeded');
    
    if (isRateLimit) {
      console.warn('⚠️  Rate limit detected, will retry with longer delay...');
    }
    
    return rpcErrorPatterns.some(pattern => errorMessage.includes(pattern)) && !isGasError;
  }

  getRpcStatus() {
    return {
      currentEndpoint: this.rpcEndpoints[this.currentProviderIndex],
      totalEndpoints: this.rpcEndpoints.length,
      currentIndex: this.currentProviderIndex,
      maxRetries: this.maxRetries,
      retryDelay: this.retryDelay,
      allEndpoints: this.rpcEndpoints
    };
  }

  async testRpcConnectivity() {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      return {
        success: true,
        currentEndpoint: this.rpcEndpoints[this.currentProviderIndex],
        blockNumber: blockNumber,
        chainId: await this.provider.getNetwork().then(n => n.chainId)
      };
    } catch (error) {
      return {
        success: false,
        currentEndpoint: this.rpcEndpoints[this.currentProviderIndex],
        error: error.message
      };
    }
  }

  switchToProvider(index) {
    if (index >= 0 && index < this.rpcEndpoints.length) {
      this.currentProviderIndex = index;
      this.initializeProvider();
      return true;
    }
    return false;
  }

  getRateLimitInfo() {
    const currentEndpoint = this.rpcEndpoints[this.currentProviderIndex];
    const isInfura = currentEndpoint.includes('infura.io');
    const isAlchemy = currentEndpoint.includes('alchemy.com');
    
    return {
      currentEndpoint,
      isInfura,
      isAlchemy,
      recommendations: {
        infura: isInfura ? [
          'Consider upgrading to a paid Infura plan for higher rate limits',
          'Add ALCHEMY_API_KEY for additional fallback',
          'Use multiple RPC providers to distribute load'
        ] : [],
        alchemy: isAlchemy ? [
          'Consider upgrading to a paid Alchemy plan for higher rate limits',
          'Add INFURA_API_KEY for additional fallback',
          'Use multiple RPC providers to distribute load'
        ] : [],
        general: [
          'The SDK automatically handles rate limits with failover',
          'Rate limits reset over time (usually per minute/hour)',
          'Consider implementing request batching to reduce API calls'
        ]
      }
    };
  }

  getContractAddresses() {
    return {
      pool: getAddress('0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951'),
      poolDataProvider: getAddress('0x41393e5e337606dc3821075Af65AeE84D7688CBD'),
      aaveOracle: getAddress('0x54586bE62E3c3580375aE3723C145253060Ca0C2'),
      weth: getAddress('0xdd13e55209fd76afe204dbda4007c227904f0a81'),
      usdc: getAddress('0x1c7d4b196cb0c7b01d743fbc6116a902379c7238'),
      dai: getAddress('0x68194a729c2450ad26072b3d33adacbcef39d574'),
    };
  }

  getPoolABI() {
    return [
      "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external",
      "function withdraw(address asset, uint256 amount, address to) external returns (uint256)",
      "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external",
      "function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) external returns (uint256)",
      "function getUserAccountData(address user) external view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
      "function getReserveData(address asset) external view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))",
      "function getReservesList() external view returns (address[] memory)"
    ];
  }

  getTokenDecimals(assetAddress) {
    const assets = this.getSupportedAssets();
    return assets[assetAddress]?.decimals || 18;
  }

  parseAmount(amount, assetAddress) {
    const decimals = this.getTokenDecimals(assetAddress);
    return ethers.parseUnits(amount.toString(), decimals);
  }

  formatAmount(amount, assetAddress) {
    try {
      const decimals = this.getTokenDecimals(assetAddress);
      const amountBigInt = typeof amount === 'string' ? BigInt(amount) : BigInt(amount);
      return ethers.formatUnits(amountBigInt, decimals);
    } catch (error) {
      return '0.0';
    }
  }

  async getReserveData(assetAddress) {
    return await this.executeWithFailover(async () => {
      const reserveData = await this.poolContract.getReserveData(assetAddress);
      
      return {
        configuration: reserveData.configuration,
        liquidityIndex: reserveData.liquidityIndex,
        currentLiquidityRate: reserveData.currentLiquidityRate,
        variableBorrowIndex: reserveData.variableBorrowIndex,
        currentVariableBorrowRate: reserveData.currentVariableBorrowRate,
        currentStableBorrowRate: reserveData.currentStableBorrowRate,
        lastUpdateTimestamp: reserveData.lastUpdateTimestamp,
        aTokenAddress: reserveData.aTokenAddress,
        stableDebtTokenAddress: reserveData.stableDebtTokenAddress,
        variableDebtTokenAddress: reserveData.variableDebtTokenAddress,
        interestRateStrategyAddress: reserveData.interestRateStrategyAddress,
        accruedToTreasury: reserveData.accruedToTreasury,
        unbacked: reserveData.unbacked,
        isolationModeTotalDebt: reserveData.isolationModeTotalDebt
      };
    });
  }

  async getUserAccountData(userAddress) {
    return await this.executeWithFailover(async () => {
      const accountData = await this.poolContract.getUserAccountData(userAddress);
      
      return {
        totalCollateralETH: accountData.totalCollateralETH,
        totalDebtETH: accountData.totalDebtETH,
        availableBorrowsETH: accountData.availableBorrowsETH,
        currentLiquidationThreshold: accountData.currentLiquidationThreshold,
        ltv: accountData.ltv,
        healthFactor: accountData.healthFactor
      };
    });
  }

  calculateHealthFactor(totalCollateral, totalDebt, liquidationThreshold) {
    if (totalDebt === 0n) {
      return this.MAX_UINT256;
    }
    
    return (totalCollateral * BigInt(liquidationThreshold)) / (totalDebt * 10000n);
  }

  formatHealthFactor(healthFactor) {
    if (healthFactor === this.MAX_UINT256) {
      return '∞';
    }
    return Number(healthFactor) / 1e18;
  }

  async getAssetPrice(assetAddress) {
    return await this.executeWithFailover(async () => {
      const oracleABI = [
        "function getAssetPrice(address asset) external view returns (uint256)"
      ];
      
      const oracleContract = new ethers.Contract(this.contracts.aaveOracle, oracleABI, this.provider);
      const price = await oracleContract.getAssetPrice(assetAddress);
      return price;
    }).catch(error => {
      console.warn(`Failed to get asset price for ${assetAddress}: ${error.message}`);
      return BigInt(1e18);
    });
  }

  async convertTokenToEth(amountWei, assetAddress) {
    try {
      const priceInEth = await this.getAssetPrice(assetAddress);
      const decimals = this.getTokenDecimals(assetAddress);
      const amountInEth = (amountWei * priceInEth) / BigInt(10 ** decimals);
      return amountInEth;
    } catch (error) {
      console.warn(`Failed to convert token to ETH for ${assetAddress}: ${error.message}`);
      return amountWei;
    }
  }

  async estimateGas(functionName, params) {
    return await this.executeWithFailover(async () => {
      const data = this.poolContract.interface.encodeFunctionData(functionName, params);
      const gasEstimate = await this.provider.estimateGas({
        to: this.contracts.pool,
        data: data
      });
      return gasEstimate;
    }).catch(error => {
      const fallbackGas = {
        'supply': 200000,
        'withdraw': 150000,
        'borrow': 250000,
        'repay': 200000
      };
      return BigInt(fallbackGas[functionName] || 200000);
    });
  }

  async simulateSupply(assetAddress, amount, userAddress) {
    try {
      const reserveData = await this.getReserveData(assetAddress);
      const userData = await this.getUserAccountData(userAddress);
      
      const amountWei = this.parseAmount(amount, assetAddress);
      const amountInEth = await this.convertTokenToEth(amountWei, assetAddress);
      
      const liquidityIndex = BigInt(reserveData.liquidityIndex);
      const aTokenAmount = (amountWei * liquidityIndex) / BigInt(1e27);
      
      const newTotalCollateral = BigInt(userData.totalCollateralETH) + amountInEth;
      const gasEstimate = await this.estimateGas('supply', [assetAddress, amountWei, userAddress, 0]);
      
      return {
        success: true,
        expectedATokenAmount: this.formatAmount(aTokenAmount, assetAddress),
        fee: '0',
        netAmount: this.formatAmount(amountWei, assetAddress),
        currentLiquidityRate: reserveData.currentLiquidityRate.toString(),
        newTotalCollateral: ethers.formatEther(newTotalCollateral),
        gasEstimate: gasEstimate.toString(),
        warnings: []
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        gasEstimate: '0'
      };
    }
  }

  async simulateWithdraw(assetAddress, amount, userAddress) {
    try {
      const reserveData = await this.getReserveData(assetAddress);
      const userData = await this.getUserAccountData(userAddress);
      
      // Convert amount to proper units using parseAmount
      const amountWei = this.parseAmount(amount, assetAddress);
      
      // Convert token amount to ETH value using Oracle price
      const amountInEth = await this.convertTokenToEth(amountWei, assetAddress);
      
      // Check if user has enough collateral in ETH
      const hasEnoughCollateral = BigInt(userData.totalCollateralETH) >= amountInEth;
      
      if (!hasEnoughCollateral) {
        return {
          success: false,
          error: 'Insufficient collateral to withdraw',
          gasEstimate: '0'
        };
      }
      
      // Calculate new health factor after withdrawal using proper Aave formula
      const newTotalCollateral = BigInt(userData.totalCollateralETH) - amountInEth;
      const newHealthFactor = this.calculateHealthFactor(
        newTotalCollateral, 
        BigInt(userData.totalDebtETH), 
        userData.currentLiquidationThreshold
      );
      
      // Estimate gas for withdraw transaction
      const gasEstimate = await this.estimateGas('withdraw', [assetAddress, amountWei, userAddress]);
      
      return {
        success: true,
        expectedWithdrawAmount: this.formatAmount(amountWei, assetAddress),
        newTotalCollateral: ethers.formatEther(newTotalCollateral),
        newHealthFactor: this.formatHealthFactor(newHealthFactor),
        currentLiquidityRate: reserveData.currentLiquidityRate.toString(),
        gasEstimate: gasEstimate.toString(),
        warnings: newHealthFactor < BigInt(1e18) ? ['Health factor below 1.0 after withdrawal'] : []
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        gasEstimate: '0'
      };
    }
  }

  /**
   * Simulate borrow transaction
   */
  async simulateBorrow(assetAddress, amount, interestRateMode, userAddress) {
    try {
      const reserveData = await this.getReserveData(assetAddress);
      const userData = await this.getUserAccountData(userAddress);
      
      // Convert amount to proper units using parseAmount
      const amountWei = this.parseAmount(amount, assetAddress);
      
      // Convert borrow amount to ETH value using Oracle price
      const borrowInEth = await this.convertTokenToEth(amountWei, assetAddress);
      
      // Check if user has enough collateral to borrow in ETH
      const hasEnoughCollateral = BigInt(userData.availableBorrowsETH) >= borrowInEth;
      
      if (!hasEnoughCollateral) {
        return {
          success: false,
          error: 'Insufficient collateral to borrow this amount',
          gasEstimate: '0'
        };
      }
      
      // Calculate new health factor after borrowing using proper Aave formula
      const newTotalDebt = BigInt(userData.totalDebtETH) + borrowInEth;
      const newHealthFactor = this.calculateHealthFactor(
        BigInt(userData.totalCollateralETH), 
        newTotalDebt, 
        userData.currentLiquidationThreshold
      );
      
      // Get current borrow rate
      const currentBorrowRate = interestRateMode === 1 
        ? reserveData.currentStableBorrowRate 
        : reserveData.currentVariableBorrowRate;
      
      // Estimate gas for borrow transaction
      const gasEstimate = await this.estimateGas('borrow', [assetAddress, amountWei, interestRateMode, 0, userAddress]);
      
      return {
        success: true,
        expectedBorrowAmount: this.formatAmount(amountWei, assetAddress),
        newTotalDebt: ethers.formatEther(newTotalDebt),
        newHealthFactor: this.formatHealthFactor(newHealthFactor),
        currentBorrowRate: currentBorrowRate.toString(),
        interestRateMode: interestRateMode,
        gasEstimate: gasEstimate.toString(),
        warnings: newHealthFactor < BigInt(1.5e18) ? ['Health factor below 1.5 after borrowing'] : []
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        gasEstimate: '0'
      };
    }
  }

  /**
   * Simulate repay transaction
   */
  async simulateRepay(assetAddress, amount, interestRateMode, userAddress) {
    try {
      const reserveData = await this.getReserveData(assetAddress);
      const userData = await this.getUserAccountData(userAddress);
      
      // Convert amount to proper units using parseAmount
      const amountWei = this.parseAmount(amount, assetAddress);
      
      // Convert repay amount to ETH value using Oracle price
      const repayInEth = await this.convertTokenToEth(amountWei, assetAddress);
      
      // Check if user has enough debt to repay
      const hasEnoughDebt = BigInt(userData.totalDebtETH) >= repayInEth;
      
      if (!hasEnoughDebt) {
        return {
          success: false,
          error: 'Repay amount exceeds total debt',
          gasEstimate: '0'
        };
      }
      
      // Calculate new health factor after repaying using proper Aave formula
      const newTotalDebt = BigInt(userData.totalDebtETH) - repayInEth;
      const newHealthFactor = this.calculateHealthFactor(
        BigInt(userData.totalCollateralETH), 
        newTotalDebt, 
        userData.currentLiquidationThreshold
      );
      
      // Get current borrow rate
      const currentBorrowRate = interestRateMode === 1 
        ? reserveData.currentStableBorrowRate 
        : reserveData.currentVariableBorrowRate;
      
      // Estimate gas for repay transaction
      const gasEstimate = await this.estimateGas('repay', [assetAddress, amountWei, interestRateMode, userAddress]);
      
      return {
        success: true,
        expectedRepayAmount: this.formatAmount(amountWei, assetAddress),
        newTotalDebt: ethers.formatEther(newTotalDebt),
        newHealthFactor: this.formatHealthFactor(newHealthFactor),
        currentBorrowRate: currentBorrowRate.toString(),
        interestRateMode: interestRateMode,
        gasEstimate: gasEstimate.toString(),
        warnings: newHealthFactor > BigInt(2e18) ? ['Health factor above 2.0 - consider withdrawing excess collateral'] : []
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        gasEstimate: '0'
      };
    }
  }

  /**
   * Generate supply transaction data
   */
  async generateSupplyTransaction(assetAddress, amount, onBehalfOf, referralCode = 0) {
    // Convert amount to proper units
    const amountWei = this.parseAmount(amount, assetAddress);
    
    const data = this.poolContract.interface.encodeFunctionData('supply', [
      assetAddress,
      amountWei,
      onBehalfOf,
      referralCode
    ]);
    
    // Estimate gas dynamically
    const gasEstimate = await this.estimateGas('supply', [assetAddress, amountWei, onBehalfOf, referralCode]);
    
    return {
      to: this.contracts.pool,
      data: data,
      value: '0x0',
      gasLimit: gasEstimate.toString(),
      functionName: 'supply',
      parameters: {
        asset: assetAddress,
        amount: amountWei.toString(),
        onBehalfOf: onBehalfOf,
        referralCode: referralCode
      }
    };
  }

  /**
   * Generate withdraw transaction data
   */
  async generateWithdrawTransaction(assetAddress, amount, to) {
    // Convert amount to proper units
    const amountWei = this.parseAmount(amount, assetAddress);
    
    const data = this.poolContract.interface.encodeFunctionData('withdraw', [
      assetAddress,
      amountWei,
      to
    ]);
    
    // Estimate gas dynamically
    const gasEstimate = await this.estimateGas('withdraw', [assetAddress, amountWei, to]);
    
    return {
      to: this.contracts.pool,
      data: data,
      value: '0x0',
      gasLimit: gasEstimate.toString(),
      functionName: 'withdraw',
      parameters: {
        asset: assetAddress,
        amount: amountWei.toString(),
        to: to
      }
    };
  }

  /**
   * Generate borrow transaction data
   */
  async generateBorrowTransaction(assetAddress, amount, interestRateMode, onBehalfOf, referralCode = 0) {
    // Convert amount to proper units
    const amountWei = this.parseAmount(amount, assetAddress);
    
    const data = this.poolContract.interface.encodeFunctionData('borrow', [
      assetAddress,
      amountWei,
      interestRateMode,
      referralCode,
      onBehalfOf
    ]);
    
    // Estimate gas dynamically
    const gasEstimate = await this.estimateGas('borrow', [assetAddress, amountWei, interestRateMode, referralCode, onBehalfOf]);
    
    return {
      to: this.contracts.pool,
      data: data,
      value: '0x0',
      gasLimit: gasEstimate.toString(),
      functionName: 'borrow',
      parameters: {
        asset: assetAddress,
        amount: amountWei.toString(),
        interestRateMode: interestRateMode,
        referralCode: referralCode,
        onBehalfOf: onBehalfOf
      }
    };
  }

  /**
   * Generate repay transaction data
   */
  async generateRepayTransaction(assetAddress, amount, interestRateMode, onBehalfOf) {
    // Convert amount to proper units
    const amountWei = this.parseAmount(amount, assetAddress);
    
    const data = this.poolContract.interface.encodeFunctionData('repay', [
      assetAddress,
      amountWei,
      interestRateMode,
      onBehalfOf
    ]);
    
    const gasEstimate = await this.estimateGas('repay', [assetAddress, amountWei, interestRateMode, onBehalfOf]);
    
    return {
      to: this.contracts.pool,
      data: data,
      value: '0x0',
      gasLimit: gasEstimate.toString(),
      functionName: 'repay',
      parameters: {
        asset: assetAddress,
        amount: amountWei.toString(),
        interestRateMode: interestRateMode,
        onBehalfOf: onBehalfOf
      }
    };
  }

  getSupportedAssets() {
    return {
      [this.contracts.weth]: {
        symbol: 'WETH',
        name: 'Wrapped Ether',
        decimals: 18
      },
      [this.contracts.usdc]: {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6
      },
      [this.contracts.dai]: {
        symbol: 'DAI',
        name: 'Dai Stablecoin',
        decimals: 18
      }
    };
  }
}

export default AaveV3SDK;
