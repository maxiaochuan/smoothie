interface SmoothieChartOptions {
    responsive?: boolean;
}

const defaults: SmoothieChartOptions = {
  responsive: true,
}

export default class SmoothieChart {
  private options: SmoothieChartOptions;

  constructor(options: Partial<SmoothieChart> = {}) {
    this.options = { ...defaults, ...options }
  }
}
