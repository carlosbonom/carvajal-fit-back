import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) { }

    @Get('stats')
    async getStats() {
        const globalStats = await this.dashboardService.getGlobalStats();
        return globalStats;
    }

    @Get('activity')
    async getActivity() {
        return this.dashboardService.getRecentActivity();
    }

    @Get('reports')
    async getReports() {
        return this.dashboardService.getReportsData();
    }
}
