import { Injectable } from '@nestjs/common';

interface CreditFactorInput {
  factor: string;
  value: string;
  impact: string;
  status: string;
}

export interface SimulationResult {
  currentScore: number;
  estimatedNewScore: number;
  scoreChange: number;
  factorsAffected: {
    factor: string;
    currentStatus: string;
    projectedStatus: string;
    impact: string;
  }[];
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
}

// Simplified VantageScore weighting
const FACTOR_WEIGHTS: Record<string, number> = {
  payment_history: 0.4,
  credit_utilization: 0.2,
  credit_age: 0.21,
  total_accounts: 0.11, // credit mix proxy
  hard_inquiries: 0.05,
  derogatory_marks: 0.03,
};

const STATUS_SCORES: Record<string, number> = {
  good: 1.0,
  fair: 0.7,
  poor: 0.4,
  needs_work: 0.2,
};

@Injectable()
export class CreditSimulatorService {
  simulate(
    currentScore: number,
    currentFactors: CreditFactorInput[],
    scenario: string,
    params?: { amount?: number; currentUtilization?: number; targetUtilization?: number },
  ): SimulationResult {
    switch (scenario) {
      case 'open_credit_card':
        return this.simulateOpenCreditCard(currentScore, currentFactors);
      case 'pay_down_debt':
        return this.simulatePayDownDebt(currentScore, currentFactors, params);
      case 'close_account':
        return this.simulateCloseAccount(currentScore, currentFactors);
      case 'late_payment':
        return this.simulateLatePayment(currentScore, currentFactors);
      case 'increase_credit_limit':
        return this.simulateIncreaseCreditLimit(currentScore, currentFactors, params);
      case 'apply_for_mortgage':
        return this.simulateApplyForMortgage(currentScore, currentFactors);
      default:
        return {
          currentScore,
          estimatedNewScore: currentScore,
          scoreChange: 0,
          factorsAffected: [],
          confidence: 'low',
          explanation: 'Unknown scenario.',
        };
    }
  }

  private simulateOpenCreditCard(
    currentScore: number,
    factors: CreditFactorInput[],
  ): SimulationResult {
    const factorsAffected: SimulationResult['factorsAffected'] = [];
    let scoreImpact = 0;

    // Hard inquiry: -5 to -10 points
    const inquiryFactor = factors.find((f) => f.factor === 'hard_inquiries');
    const inquiryPenalty = -8;
    scoreImpact += inquiryPenalty;
    factorsAffected.push({
      factor: 'hard_inquiries',
      currentStatus: inquiryFactor?.status || 'good',
      projectedStatus: this.degradeStatus(inquiryFactor?.status || 'good'),
      impact: 'negative',
    });

    // Credit age decreases: -3 to -7 points
    const ageFactor = factors.find((f) => f.factor === 'credit_age');
    scoreImpact += -5;
    factorsAffected.push({
      factor: 'credit_age',
      currentStatus: ageFactor?.status || 'fair',
      projectedStatus: this.degradeStatus(ageFactor?.status || 'fair'),
      impact: 'negative',
    });

    // Total accounts increase: +2 to +5 points (credit mix improvement)
    const accountsFactor = factors.find((f) => f.factor === 'total_accounts');
    scoreImpact += 3;
    factorsAffected.push({
      factor: 'total_accounts',
      currentStatus: accountsFactor?.status || 'fair',
      projectedStatus: this.improveStatus(accountsFactor?.status || 'fair'),
      impact: 'positive',
    });

    // Utilization may improve with higher total credit
    const utilFactor = factors.find((f) => f.factor === 'credit_utilization');
    if (utilFactor && (utilFactor.status === 'poor' || utilFactor.status === 'needs_work')) {
      scoreImpact += 5;
      factorsAffected.push({
        factor: 'credit_utilization',
        currentStatus: utilFactor.status,
        projectedStatus: this.improveStatus(utilFactor.status),
        impact: 'positive',
      });
    }

    const estimatedNewScore = this.clampScore(currentScore + scoreImpact);

    return {
      currentScore,
      estimatedNewScore,
      scoreChange: estimatedNewScore - currentScore,
      factorsAffected,
      confidence: 'medium',
      explanation:
        'Opening a new credit card typically causes a short-term dip due to the hard inquiry and reduced average account age, but can improve your credit mix and utilization ratio over time.',
    };
  }

  private simulatePayDownDebt(
    currentScore: number,
    factors: CreditFactorInput[],
    params?: { amount?: number; currentUtilization?: number; targetUtilization?: number },
  ): SimulationResult {
    const factorsAffected: SimulationResult['factorsAffected'] = [];
    let scoreImpact = 0;

    const utilFactor = factors.find((f) => f.factor === 'credit_utilization');
    const currentUtil = params?.currentUtilization ?? this.statusToUtilization(utilFactor?.status || 'fair');
    const targetUtil = params?.targetUtilization ?? Math.max(currentUtil - 20, 1);

    // Utilization improvement: every 10% reduction ~ +10-20 points
    const utilReduction = currentUtil - targetUtil;
    if (utilReduction > 0) {
      scoreImpact += Math.round(utilReduction * 1.2);
      const projectedStatus = this.utilizationToStatus(targetUtil);
      factorsAffected.push({
        factor: 'credit_utilization',
        currentStatus: utilFactor?.status || 'fair',
        projectedStatus,
        impact: 'positive',
      });
    }

    const estimatedNewScore = this.clampScore(currentScore + scoreImpact);

    return {
      currentScore,
      estimatedNewScore,
      scoreChange: estimatedNewScore - currentScore,
      factorsAffected,
      confidence: utilReduction > 0 ? 'high' : 'medium',
      explanation:
        `Reducing your credit utilization from ${currentUtil}% to ${targetUtil}% can significantly boost your score. Keeping utilization below 30% is recommended, and below 10% is ideal.`,
    };
  }

  private simulateCloseAccount(
    currentScore: number,
    factors: CreditFactorInput[],
  ): SimulationResult {
    const factorsAffected: SimulationResult['factorsAffected'] = [];
    let scoreImpact = 0;

    // Credit age may increase or decrease depending on which account
    const ageFactor = factors.find((f) => f.factor === 'credit_age');
    scoreImpact += -5;
    factorsAffected.push({
      factor: 'credit_age',
      currentStatus: ageFactor?.status || 'fair',
      projectedStatus: this.degradeStatus(ageFactor?.status || 'fair'),
      impact: 'negative',
    });

    // Utilization may worsen (less total available credit)
    const utilFactor = factors.find((f) => f.factor === 'credit_utilization');
    scoreImpact += -8;
    factorsAffected.push({
      factor: 'credit_utilization',
      currentStatus: utilFactor?.status || 'fair',
      projectedStatus: this.degradeStatus(utilFactor?.status || 'fair'),
      impact: 'negative',
    });

    // Total accounts decrease
    const accountsFactor = factors.find((f) => f.factor === 'total_accounts');
    scoreImpact += -3;
    factorsAffected.push({
      factor: 'total_accounts',
      currentStatus: accountsFactor?.status || 'fair',
      projectedStatus: this.degradeStatus(accountsFactor?.status || 'fair'),
      impact: 'negative',
    });

    const estimatedNewScore = this.clampScore(currentScore + scoreImpact);

    return {
      currentScore,
      estimatedNewScore,
      scoreChange: estimatedNewScore - currentScore,
      factorsAffected,
      confidence: 'medium',
      explanation:
        'Closing an account reduces your total available credit, which can increase your utilization ratio. It may also affect your credit age and account mix negatively.',
    };
  }

  private simulateLatePayment(
    currentScore: number,
    factors: CreditFactorInput[],
  ): SimulationResult {
    const factorsAffected: SimulationResult['factorsAffected'] = [];

    // Late payments have the largest single impact: -60 to -110 points
    // Impact is worse for higher scores
    let scoreImpact: number;
    if (currentScore >= 780) {
      scoreImpact = -90;
    } else if (currentScore >= 720) {
      scoreImpact = -70;
    } else if (currentScore >= 660) {
      scoreImpact = -50;
    } else {
      scoreImpact = -30;
    }

    const paymentFactor = factors.find((f) => f.factor === 'payment_history');
    factorsAffected.push({
      factor: 'payment_history',
      currentStatus: paymentFactor?.status || 'good',
      projectedStatus: 'poor',
      impact: 'negative',
    });

    const estimatedNewScore = this.clampScore(currentScore + scoreImpact);

    return {
      currentScore,
      estimatedNewScore,
      scoreChange: estimatedNewScore - currentScore,
      factorsAffected,
      confidence: 'high',
      explanation:
        'A late payment (30+ days) is one of the most damaging events for your credit score. Payment history is the single largest factor at 40% of your score. The higher your current score, the larger the drop.',
    };
  }

  private simulateIncreaseCreditLimit(
    currentScore: number,
    factors: CreditFactorInput[],
    params?: { amount?: number; currentUtilization?: number; targetUtilization?: number },
  ): SimulationResult {
    const factorsAffected: SimulationResult['factorsAffected'] = [];
    let scoreImpact = 0;

    const utilFactor = factors.find((f) => f.factor === 'credit_utilization');
    const currentUtil = params?.currentUtilization ?? this.statusToUtilization(utilFactor?.status || 'fair');
    // Increasing limit by ~50% would roughly cut utilization by a third
    const targetUtil = params?.targetUtilization ?? Math.round(currentUtil * 0.65);

    const utilReduction = currentUtil - targetUtil;
    if (utilReduction > 0) {
      scoreImpact += Math.round(utilReduction * 1.0);
      factorsAffected.push({
        factor: 'credit_utilization',
        currentStatus: utilFactor?.status || 'fair',
        projectedStatus: this.utilizationToStatus(targetUtil),
        impact: 'positive',
      });
    }

    // May involve a hard inquiry (soft pull for some issuers)
    const inquiryFactor = factors.find((f) => f.factor === 'hard_inquiries');
    scoreImpact += -3;
    factorsAffected.push({
      factor: 'hard_inquiries',
      currentStatus: inquiryFactor?.status || 'good',
      projectedStatus: inquiryFactor?.status || 'good', // minor impact
      impact: 'negative',
    });

    const estimatedNewScore = this.clampScore(currentScore + scoreImpact);

    return {
      currentScore,
      estimatedNewScore,
      scoreChange: estimatedNewScore - currentScore,
      factorsAffected,
      confidence: 'medium',
      explanation:
        `Increasing your credit limit can lower your utilization ratio from ${currentUtil}% to approximately ${targetUtil}%. Some issuers perform a hard inquiry for limit increases, which may have a small negative impact.`,
    };
  }

  private simulateApplyForMortgage(
    currentScore: number,
    factors: CreditFactorInput[],
  ): SimulationResult {
    const factorsAffected: SimulationResult['factorsAffected'] = [];

    // Hard inquiry: -5 to -10 points (mortgage inquiries within 14-45 days count as one)
    const inquiryFactor = factors.find((f) => f.factor === 'hard_inquiries');
    const scoreImpact = -7;
    factorsAffected.push({
      factor: 'hard_inquiries',
      currentStatus: inquiryFactor?.status || 'good',
      projectedStatus: this.degradeStatus(inquiryFactor?.status || 'good'),
      impact: 'negative',
    });

    const estimatedNewScore = this.clampScore(currentScore + scoreImpact);

    return {
      currentScore,
      estimatedNewScore,
      scoreChange: estimatedNewScore - currentScore,
      factorsAffected,
      confidence: 'high',
      explanation:
        'Applying for a mortgage results in a hard inquiry, which typically causes a small, temporary dip. Multiple mortgage inquiries within a 14-45 day window are usually treated as a single inquiry by scoring models.',
    };
  }

  private clampScore(score: number): number {
    return Math.max(300, Math.min(850, Math.round(score)));
  }

  private degradeStatus(status: string): string {
    const order = ['good', 'fair', 'poor', 'needs_work'];
    const idx = order.indexOf(status);
    if (idx < 0 || idx >= order.length - 1) return status;
    return order[idx + 1];
  }

  private improveStatus(status: string): string {
    const order = ['good', 'fair', 'poor', 'needs_work'];
    const idx = order.indexOf(status);
    if (idx <= 0) return status;
    return order[idx - 1];
  }

  private statusToUtilization(status: string): number {
    switch (status) {
      case 'good':
        return 10;
      case 'fair':
        return 35;
      case 'poor':
        return 60;
      case 'needs_work':
        return 80;
      default:
        return 35;
    }
  }

  private utilizationToStatus(utilization: number): string {
    if (utilization <= 10) return 'good';
    if (utilization <= 30) return 'fair';
    if (utilization <= 50) return 'poor';
    return 'needs_work';
  }
}
