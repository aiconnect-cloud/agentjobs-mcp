import { describe, it, expect } from 'vitest';
import { formatJobStats } from './formatters.js';
describe('formatJobStats', () => {
    it('should return correct percentages when total is greater than 0', () => {
        const stats = {
            status: {
                completed: 10,
                running: 5,
                failed: 2,
                canceled: 1,
                waiting: 1,
                scheduled: 1,
            },
        };
        const filters = {};
        const result = formatJobStats(stats, filters);
        expect(result).toContain('Completed:  10 jobs (50.0%)');
        expect(result).toContain('Running:     5 jobs (25.0%)');
        expect(result).toContain('Failed:      2 jobs (10.0%)');
        expect(result).toContain('Canceled:    1 jobs (5.0%)');
        expect(result).toContain('Waiting:     1 jobs (5.0%)');
        expect(result).toContain('Scheduled:  1 jobs (5.0%)');
        expect(result).toContain('Total Jobs: 20');
    });
    it('should return 0.0% for all statuses when there are no jobs', () => {
        const stats = {
            status: {
                completed: 0,
                running: 0,
                failed: 0,
                canceled: 0,
                waiting: 0,
                scheduled: 0,
            },
        };
        const filters = {};
        const result = formatJobStats(stats, filters);
        expect(result).toContain('Completed:  0 jobs (0.0%)');
        expect(result).toContain('Running:     0 jobs (0.0%)');
        expect(result).toContain('Failed:      0 jobs (0.0%)');
        expect(result).toContain('Canceled:    0 jobs (0.0%)');
        expect(result).toContain('Waiting:     0 jobs (0.0%)');
        expect(result).toContain('Scheduled:  0 jobs (0.0%)');
        expect(result).toContain('Total Jobs: 0');
    });
    it('should handle null filters gracefully', () => {
        const stats = {
            status: {
                completed: 10,
                running: 5,
                failed: 2,
                canceled: 1,
                waiting: 1,
                scheduled: 1,
            },
        };
        const filters = null;
        const result = formatJobStats(stats, filters);
        expect(result).toContain('Period: All time');
    });
});
