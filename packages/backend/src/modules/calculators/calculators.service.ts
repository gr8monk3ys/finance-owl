import { Injectable } from '@nestjs/common';
import { MortgageDto } from './dto/mortgage.dto';
import { RefinanceDto } from './dto/refinance.dto';
import { AmortizationDto } from './dto/amortization.dto';
import { CompoundInterestDto } from './dto/compound-interest.dto';
import { DtiDto } from './dto/dti.dto';
import { NetWorthDto } from './dto/net-worth.dto';

@Injectable()
export class CalculatorsService {
  calculateMortgage(dto: MortgageDto) {
    const loanAmount = dto.homePrice - dto.downPayment;
    const monthlyRate = dto.interestRate / 100 / 12;
    const totalPayments = dto.loanTermYears * 12;

    // Monthly principal & interest (standard amortization formula)
    let principalAndInterest: number;
    if (monthlyRate === 0) {
      principalAndInterest = loanAmount / totalPayments;
    } else {
      principalAndInterest =
        (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalPayments))) /
        (Math.pow(1 + monthlyRate, totalPayments) - 1);
    }

    const monthlyPropertyTax = (dto.propertyTax || 0) / 12;
    const monthlyInsurance = (dto.homeInsurance || 0) / 12;

    // PMI applies when down payment < 20%
    const downPaymentPct = dto.downPayment / dto.homePrice;
    const monthlyPMI = downPaymentPct < 0.2 ? (dto.pmi || 0) / 12 : 0;

    const monthlyPayment =
      principalAndInterest + monthlyPropertyTax + monthlyInsurance + monthlyPMI;
    const totalPayment = principalAndInterest * totalPayments;
    const totalInterest = totalPayment - loanAmount;

    // Build amortization schedule
    const amortizationSchedule = this.buildAmortizationSchedule(
      loanAmount,
      monthlyRate,
      principalAndInterest,
      totalPayments,
    );

    return {
      monthlyPayment: this.round(monthlyPayment),
      principalAndInterest: this.round(principalAndInterest),
      monthlyPropertyTax: this.round(monthlyPropertyTax),
      monthlyInsurance: this.round(monthlyInsurance),
      monthlyPMI: this.round(monthlyPMI),
      totalPayment: this.round(totalPayment),
      totalInterest: this.round(totalInterest),
      loanAmount: this.round(loanAmount),
      amortizationSchedule,
    };
  }

  calculateRefinance(dto: RefinanceDto) {
    const newMonthlyRate = dto.newRate / 100 / 12;
    const newTotalPayments = dto.newTermYears * 12;

    let newMonthlyPayment: number;
    if (newMonthlyRate === 0) {
      newMonthlyPayment = dto.currentBalance / newTotalPayments;
    } else {
      newMonthlyPayment =
        (dto.currentBalance *
          (newMonthlyRate * Math.pow(1 + newMonthlyRate, newTotalPayments))) /
        (Math.pow(1 + newMonthlyRate, newTotalPayments) - 1);
    }

    const monthlySavings = dto.currentMonthlyPayment - newMonthlyPayment;

    // Break-even: months until closing costs are recovered from savings
    const breakEvenMonths =
      monthlySavings > 0
        ? Math.ceil(dto.closingCosts / monthlySavings)
        : Infinity;

    const totalCostCurrent =
      dto.currentMonthlyPayment * dto.currentRemainingMonths;
    const totalCostNew =
      newMonthlyPayment * newTotalPayments + dto.closingCosts;
    const totalSavingsOverLife = totalCostCurrent - totalCostNew;

    return {
      newMonthlyPayment: this.round(newMonthlyPayment),
      monthlySavings: this.round(monthlySavings),
      breakEvenMonths:
        breakEvenMonths === Infinity ? null : breakEvenMonths,
      totalCostCurrent: this.round(totalCostCurrent),
      totalCostNew: this.round(totalCostNew),
      totalSavingsOverLife: this.round(totalSavingsOverLife),
    };
  }

  calculateAmortization(dto: AmortizationDto) {
    const monthlyRate = dto.interestRate / 100 / 12;
    const extraPayment = dto.extraPayment || 0;

    // Standard monthly payment (without extra)
    let monthlyPayment: number;
    if (monthlyRate === 0) {
      monthlyPayment = dto.principal / dto.termMonths;
    } else {
      monthlyPayment =
        (dto.principal *
          (monthlyRate * Math.pow(1 + monthlyRate, dto.termMonths))) /
        (Math.pow(1 + monthlyRate, dto.termMonths) - 1);
    }

    // Without extra payments
    const totalPaymentNoExtra = monthlyPayment * dto.termMonths;
    const totalInterestNoExtra = totalPaymentNoExtra - dto.principal;

    // Build schedule with extra payments
    const schedule: Array<{
      month: number;
      payment: number;
      principal: number;
      interest: number;
      extraPayment: number;
      balance: number;
    }> = [];

    let balance = dto.principal;
    let totalPaid = 0;
    let totalInterestPaid = 0;
    let month = 0;

    while (balance > 0.01 && month < dto.termMonths) {
      month++;
      const interestCharge = balance * monthlyRate;
      let principalPortion = monthlyPayment - interestCharge;

      // On the last payment, don't overpay
      let extra = extraPayment;
      if (principalPortion + extra > balance) {
        extra = Math.max(0, balance - principalPortion);
        principalPortion = Math.min(principalPortion, balance);
      }

      const totalPrincipal = principalPortion + extra;
      const payment = interestCharge + totalPrincipal;

      balance = Math.max(0, balance - totalPrincipal);
      totalPaid += payment;
      totalInterestPaid += interestCharge;

      schedule.push({
        month,
        payment: this.round(payment),
        principal: this.round(principalPortion),
        interest: this.round(interestCharge),
        extraPayment: this.round(extra),
        balance: this.round(balance),
      });
    }

    const today = new Date();
    const payoffDate = new Date(
      today.getFullYear(),
      today.getMonth() + month,
      today.getDate(),
    );

    const interestSaved = totalInterestNoExtra - totalInterestPaid;

    return {
      monthlyPayment: this.round(monthlyPayment),
      totalPayment: this.round(totalPaid),
      totalInterest: this.round(totalInterestPaid),
      payoffDate: payoffDate.toISOString().split('T')[0],
      payoffMonths: month,
      interestSaved: this.round(Math.max(0, interestSaved)),
      monthsSaved: dto.termMonths - month,
      amortizationSchedule: schedule,
    };
  }

  calculateCompoundInterest(dto: CompoundInterestDto) {
    const frequencyMap: Record<string, number> = {
      daily: 365,
      monthly: 12,
      quarterly: 4,
      annually: 1,
    };

    const n = frequencyMap[dto.compoundingFrequency] || 12;
    const r = dto.annualRate / 100;
    const t = dto.years;
    const P = dto.initialDeposit;
    const PMT = dto.monthlyContribution;

    // Year-by-year breakdown
    const yearByYearBreakdown: Array<{
      year: number;
      balance: number;
      contributions: number;
      interestEarned: number;
    }> = [];

    let balance = P;
    let totalContributions = P;

    for (let year = 1; year <= t; year++) {
      // Calculate balance at end of year with compounding
      // For contributions, we add monthly and compound at frequency n
      const periodsPerYear = n;
      const ratePerPeriod = r / n;
      const monthsPerPeriod = 12 / n;

      let yearStart = balance;

      for (let period = 0; period < periodsPerYear; period++) {
        // Add monthly contributions for this period
        balance += PMT * monthsPerPeriod;
        totalContributions += PMT * monthsPerPeriod;
        // Apply compounding interest for this period
        balance *= 1 + ratePerPeriod;
      }

      const interestThisYear = balance - yearStart - PMT * 12;

      yearByYearBreakdown.push({
        year,
        balance: this.round(balance),
        contributions: this.round(totalContributions),
        interestEarned: this.round(balance - totalContributions),
      });
    }

    const futureValue = balance;
    const totalContributionsFinal = P + PMT * 12 * t;
    const totalInterestEarned = futureValue - totalContributionsFinal;

    return {
      futureValue: this.round(futureValue),
      totalContributions: this.round(totalContributionsFinal),
      totalInterestEarned: this.round(totalInterestEarned),
      yearByYearBreakdown,
    };
  }

  calculateDti(dto: DtiDto) {
    const totalDebt =
      (dto.mortgage || 0) +
      (dto.carPayment || 0) +
      (dto.studentLoans || 0) +
      (dto.creditCards || 0) +
      (dto.otherDebts || 0);

    const dtiRatio = (totalDebt / dto.monthlyIncome) * 100;

    let rating: string;
    if (dtiRatio <= 20) {
      rating = 'excellent';
    } else if (dtiRatio <= 35) {
      rating = 'good';
    } else if (dtiRatio <= 43) {
      rating = 'fair';
    } else {
      rating = 'poor';
    }

    // Max recommended DTI is 43% (conventional mortgage threshold)
    const maxRecommendedDebt = dto.monthlyIncome * 0.43;
    const remainingCapacity = Math.max(0, maxRecommendedDebt - totalDebt);

    return {
      dtiRatio: this.round(dtiRatio),
      rating,
      totalMonthlyDebt: this.round(totalDebt),
      monthlyIncome: this.round(dto.monthlyIncome),
      maxRecommendedDebt: this.round(maxRecommendedDebt),
      remainingCapacity: this.round(remainingCapacity),
      debtBreakdown: {
        mortgage: this.round(dto.mortgage || 0),
        carPayment: this.round(dto.carPayment || 0),
        studentLoans: this.round(dto.studentLoans || 0),
        creditCards: this.round(dto.creditCards || 0),
        otherDebts: this.round(dto.otherDebts || 0),
      },
    };
  }

  calculateNetWorth(dto: NetWorthDto) {
    const assets = {
      cashAndSavings: dto.cashAndSavings || 0,
      investments: dto.investments || 0,
      propertyValue: dto.propertyValue || 0,
      vehicleValue: dto.vehicleValue || 0,
      otherAssets: dto.otherAssets || 0,
    };

    const liabilities = {
      mortgageBalance: dto.mortgageBalance || 0,
      autoLoans: dto.autoLoans || 0,
      studentLoans: dto.studentLoans || 0,
      creditCardDebt: dto.creditCardDebt || 0,
      otherLiabilities: dto.otherLiabilities || 0,
    };

    const totalAssets = Object.values(assets).reduce((sum, v) => sum + v, 0);
    const totalLiabilities = Object.values(liabilities).reduce(
      (sum, v) => sum + v,
      0,
    );
    const netWorth = totalAssets - totalLiabilities;

    // Calculate percentage breakdowns
    const assetBreakdown = totalAssets > 0
      ? Object.entries(assets).map(([key, value]) => ({
          category: key,
          amount: this.round(value),
          percentage: this.round((value / totalAssets) * 100),
        }))
      : Object.entries(assets).map(([key, value]) => ({
          category: key,
          amount: 0,
          percentage: 0,
        }));

    const liabilityBreakdown = totalLiabilities > 0
      ? Object.entries(liabilities).map(([key, value]) => ({
          category: key,
          amount: this.round(value),
          percentage: this.round((value / totalLiabilities) * 100),
        }))
      : Object.entries(liabilities).map(([key, value]) => ({
          category: key,
          amount: 0,
          percentage: 0,
        }));

    return {
      totalAssets: this.round(totalAssets),
      totalLiabilities: this.round(totalLiabilities),
      netWorth: this.round(netWorth),
      assetBreakdown,
      liabilityBreakdown,
    };
  }

  private buildAmortizationSchedule(
    loanAmount: number,
    monthlyRate: number,
    monthlyPayment: number,
    totalPayments: number,
  ) {
    const schedule: Array<{
      month: number;
      payment: number;
      principal: number;
      interest: number;
      balance: number;
    }> = [];

    let balance = loanAmount;

    for (let month = 1; month <= totalPayments; month++) {
      const interest = balance * monthlyRate;
      let principal = monthlyPayment - interest;

      // Last payment adjustment
      if (principal > balance) {
        principal = balance;
      }

      balance = Math.max(0, balance - principal);

      schedule.push({
        month,
        payment: this.round(monthlyPayment),
        principal: this.round(principal),
        interest: this.round(interest),
        balance: this.round(balance),
      });
    }

    return schedule;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
