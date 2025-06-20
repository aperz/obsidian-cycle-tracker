import { App } from 'obsidian';
import type CycleTracker from './main';
import type { CycleTrackerSettings } from './settings';

// === CLEAN DATA INTERFACES ===

/** Raw symptom data - what's actually recorded in daily notes */
export interface DailySymptoms {
    date: Date;
    periodFlow: string | null;
    discharge: string | null;
    cramps: boolean | null;
    bloating: boolean | null;
    breastTenderness: boolean | null;
    headaches: boolean | null;
    bowelChanges: string | null;
    mood: string | null;
    energyLevels: string | null;
    anxiety: string | null;
    concentration: string | null;
    sexDrive: string | null;
    physicalActivity: string | null;
    nutrition: string | null;
    waterIntake: string | null;
    alcoholConsumption: string | null;
    medication: string | null;
    sexualActivity: string | null;
}

/** A detected period cycle */
export interface PeriodCycle {
    id: string; // unique identifier
    startDate: Date;
    endDate: Date; // last day with period flow
    periodDays: number; // actual days with flow
    cycleLength?: number; // days to next cycle start (if known)
}

/** Computed cycle information for any date */
export interface CycleInfo {
    cycleDay: number; // 1-based day in cycle
    cycle: PeriodCycle;
    phase: 'menstrual' | 'follicular' | 'ovulation' | 'luteal';
    isActualPeriodDay: boolean;
    isPredictedPeriodDay: boolean;
    isFertileWindow: boolean;
    isOvulationDay: boolean;
}

/** Main data container - clean separation */
export interface CycleData {
    symptoms: Map<string, DailySymptoms>; // keyed by YYYY-MM-DD
    cycles: PeriodCycle[];
    dateRange: {
        earliest: Date;
        latest: Date;
    };
}

// === CLEAN DATA PROCESSING ===

export class DataProcessor {
    private app: App;
    private plugin: CycleTracker;
    private validatedFolderPath: string | null = null;
    
    constructor(app: App, plugin: CycleTracker) {
        this.app = app;
        this.plugin = plugin;
    }

    // === PUBLIC API ===

    /**
     * Load cycle data from daily notes
     */
    async loadCycleData(settings: CycleTrackerSettings, months: number = 3): Promise<CycleData> {
        console.log('Loading cycle data...');
        
        // 1. Load raw symptom data
        const symptoms = await this.loadRawSymptoms(settings, months);
        
        // 2. Detect period cycles
        const cycles = this.detectPeriodCycles(symptoms);
        
        // 3. Calculate date range
        const dateRange = this.calculateDateRange(symptoms);
        
        return {
            symptoms,
            cycles,
            dateRange
        };
    }

    /**
     * Get cycle information for a specific date (computed on demand)
     */
    getCycleInfo(data: CycleData, date: Date): CycleInfo | null {
        const cycle = this.findCycleForDate(data.cycles, date);
        if (!cycle) return null;

        const cycleDay = this.calculateCycleDay(cycle, date);
        const phase = this.calculatePhase(cycle, cycleDay, data.cycles);
        const dayKey = this.formatDateKey(date);
        const symptoms = data.symptoms.get(dayKey);
        
        return {
            cycleDay,
            cycle,
            phase,
            isActualPeriodDay: this.isActualPeriodDay(symptoms),
            isPredictedPeriodDay: this.isPredictedPeriodDay(cycle, cycleDay, symptoms),
            isFertileWindow: this.isFertileWindow(cycle, cycleDay, data.cycles, date),
            isOvulationDay: this.isOvulationDay(cycle, cycleDay, data.cycles, date)
        };
    }

    /**
     * Get next predicted period date
     */
    getNextPeriodDate(data: CycleData): Date | null {
        if (data.cycles.length === 0) return null;

        const latestCycle = data.cycles[data.cycles.length - 1];
        const avgCycleLength = this.calculateAverageCycleLength(data.cycles);
        
        const nextPeriodDate = new Date(latestCycle.startDate);
        nextPeriodDate.setDate(nextPeriodDate.getDate() + avgCycleLength);
        
        return nextPeriodDate;
    }

    /**
     * Get predicted period end date for a specific cycle
     */
    getPredictedPeriodEndForCycle(data: CycleData, cycle: any): Date | null {
        if (!cycle) return null;
        
        // Get the predicted cycle length for this specific cycle
        const cycleLength = this.getPredictedCycleLength(data.cycles, cycle);
        
        // Calculate the end of this cycle (start of next period)
        const cycleEndDate = new Date(cycle.startDate);
        cycleEndDate.setDate(cycleEndDate.getDate() + cycleLength);
        
        return cycleEndDate;
    }

    /**
     * Get the first recorded period date (Day 1 of first cycle)
     */
    getFirstRecordedPeriodDate(data: CycleData): Date | null {
        if (data.cycles.length === 0) return null;
        
        // Find the earliest cycle start date
        const sortedCycles = [...data.cycles].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
        return sortedCycles[0].startDate;
    }

    /**
     * Determine what type of cycle a date belongs to
     */
    getCycleType(data: CycleData, date: Date): 'current' | 'past' | 'future' | 'none' {
        if (data.cycles.length === 0) return 'none';
        
        const today = new Date();
        const latestCycle = data.cycles[data.cycles.length - 1];
        
        // Get cycle info to see if date belongs to any cycle
        const cycleInfo = this.getCycleInfo(data, date);
        if (!cycleInfo) return 'none';
        
        // Check if this is the latest (current) cycle
        if (cycleInfo.cycle.id === latestCycle.id) {
            // If the cycle start is in the future, it's a future cycle
            if (cycleInfo.cycle.startDate > today) {
                return 'future';
            }
            // If we're in the current cycle or it's ongoing
            return 'current';
        }
        
        // Check if the cycle is from the past
        const cycleLength = this.getPredictedCycleLength(data.cycles, cycleInfo.cycle);
        const cycleEndDate = new Date(cycleInfo.cycle.startDate);
        cycleEndDate.setDate(cycleEndDate.getDate() + cycleLength - 1);
        
        if (cycleEndDate < today) {
            return 'past';
        }
        
        return 'none';
    }

    // === PRIVATE IMPLEMENTATION ===

    /**
     * Load raw symptom data from daily notes using Dataview only
     */
    private async loadRawSymptoms(settings: CycleTrackerSettings, months: number): Promise<Map<string, DailySymptoms>> {
        const symptoms = new Map<string, DailySymptoms>();
        
        // Date range for loading
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);
        
        try {
            // Require Dataview plugin
            if (!this.hasDataviewPlugin()) {
                throw new Error('Dataview plugin is required for cycle tracking. Please install and enable the Dataview plugin.');
            }
            
            await this.loadSymptomsWithDataview(symptoms, settings, startDate, endDate);
        } catch (error) {
            console.error('Error loading symptoms:', error);
            throw error; // Re-throw to let caller handle
        }

        console.log(`Loaded ${symptoms.size} days of symptom data`);
        return symptoms;
    }

    /**
     * Detect period cycles from symptom data
     */
    private detectPeriodCycles(symptoms: Map<string, DailySymptoms>): PeriodCycle[] {
        console.log('Detecting period cycles...');
        
        // Get all dates with period flow, sorted chronologically
        const periodDates = Array.from(symptoms.values())
            .filter(s => this.isActualPeriodDay(s))
            .map(s => s.date)
            .sort((a, b) => a.getTime() - b.getTime());

        if (periodDates.length === 0) {
            console.log('No period data found');
            return [];
        }

        // Group consecutive period days into cycles
        const cycles: PeriodCycle[] = [];
        let currentCycleStart = periodDates[0];
        let currentCycleEnd = periodDates[0];
        let periodDays = 1;

        for (let i = 1; i < periodDates.length; i++) {
            const currentDate = periodDates[i];
            const daysSinceLastPeriod = this.daysBetween(currentCycleEnd, currentDate);

            if (daysSinceLastPeriod <= 2) {
                // Continue current cycle (allow 1-2 day gaps)
                currentCycleEnd = currentDate;
                periodDays++;
            } else {
                // Start new cycle
                cycles.push({
                    id: `cycle-${cycles.length + 1}`,
                    startDate: currentCycleStart,
                    endDate: currentCycleEnd,
                    periodDays: periodDays
                });

                currentCycleStart = currentDate;
                currentCycleEnd = currentDate;
                periodDays = 1;
            }
        }

        // Don't forget the last cycle
        cycles.push({
            id: `cycle-${cycles.length + 1}`,
            startDate: currentCycleStart,
            endDate: currentCycleEnd,
            periodDays: periodDays
        });

        // Calculate cycle lengths
        this.calculateCycleLengths(cycles);

        console.log(`Detected ${cycles.length} period cycles`);
        return cycles;
    }

    /**
     * Calculate cycle lengths between detected cycles
     */
    private calculateCycleLengths(cycles: PeriodCycle[]): void {
        for (let i = 0; i < cycles.length - 1; i++) {
            const currentCycle = cycles[i];
            const nextCycle = cycles[i + 1];
            
            const cycleLength = this.daysBetween(currentCycle.startDate, nextCycle.startDate);
            
            // Only set if reasonable cycle length
            if (cycleLength >= 20 && cycleLength <= 45) {
                currentCycle.cycleLength = cycleLength;
            }
        }
    }

    /**
     * Find which cycle a date belongs to
     */
    private findCycleForDate(cycles: PeriodCycle[], date: Date): PeriodCycle | null {
        // Check if date falls within any known cycle
        for (const cycle of cycles) {
            const cycleLength = this.getPredictedCycleLength(cycles, cycle);
            const cycleEndDate = new Date(cycle.startDate);
            cycleEndDate.setDate(cycleEndDate.getDate() + cycleLength - 1);
            
            if (date >= cycle.startDate && date <= cycleEndDate) {
                return cycle;
            }
        }

        // If not in any cycle, project from the closest one
        return this.projectCycleForDate(cycles, date);
    }

    /**
     * Project a cycle for dates outside known cycles
     */
    private projectCycleForDate(cycles: PeriodCycle[], date: Date): PeriodCycle | null {
        if (cycles.length === 0) return null;

        const avgCycleLength = this.calculateAverageCycleLength(cycles);
        
        // Find the closest cycle
        const sortedCycles = [...cycles].sort((a, b) => 
            Math.abs(a.startDate.getTime() - date.getTime()) - 
            Math.abs(b.startDate.getTime() - date.getTime())
        );
        
        const closestCycle = sortedCycles[0];
        
        // Project forward or backward from closest cycle
        const daysDiff = this.daysBetween(closestCycle.startDate, date);
        const cyclesAway = Math.floor(daysDiff / avgCycleLength);
        
        const projectedStartDate = new Date(closestCycle.startDate);
        projectedStartDate.setDate(projectedStartDate.getDate() + (cyclesAway * avgCycleLength));
        
        return {
            id: `projected-${this.formatDateKey(projectedStartDate)}`,
            startDate: projectedStartDate,
            endDate: new Date(projectedStartDate.getTime() + (closestCycle.periodDays - 1) * 24 * 60 * 60 * 1000),
            periodDays: closestCycle.periodDays,
            cycleLength: avgCycleLength
        };
    }

    /**
     * Calculate cycle day (1-based) for a date within a cycle
     */
    private calculateCycleDay(cycle: PeriodCycle, date: Date): number {
        const daysSinceStart = this.daysBetween(cycle.startDate, date);
        return daysSinceStart + 1;
    }

    /**
     * Calculate cycle phase based on cycle day
     */
    private calculatePhase(cycle: PeriodCycle, cycleDay: number, allCycles?: PeriodCycle[]): 'menstrual' | 'follicular' | 'ovulation' | 'luteal' {
        // Use predicted cycle length, falling back to 28 if no cycles available
        const cycleLength = allCycles ? this.getPredictedCycleLength(allCycles, cycle) : (cycle.cycleLength || 28);
        
        if (cycleDay <= cycle.periodDays) {
            return 'menstrual';
        } else if (cycleDay <= Math.floor(cycleLength * 0.5)) {
            return 'follicular';
        } else if (cycleDay <= Math.floor(cycleLength * 0.6)) {
            return 'ovulation';
        } else {
            return 'luteal';
        }
    }

    /**
     * Check if a date has actual period flow recorded
     */
    private isActualPeriodDay(symptoms?: DailySymptoms): boolean {
        return !!(symptoms?.periodFlow && symptoms.periodFlow.toLowerCase() !== 'none');
    }

    /**
     * Check if a date should show predicted period (only for future dates)
     */
    private isPredictedPeriodDay(cycle: PeriodCycle, cycleDay: number, symptoms?: DailySymptoms): boolean {
        // Don't show predictions if actual data exists
        if (this.isActualPeriodDay(symptoms)) return false;
        
        // Only show predictions for future dates
        const today = new Date();
        const dateInQuestion = new Date(cycle.startDate);
        dateInQuestion.setDate(dateInQuestion.getDate() + cycleDay - 1);
        
        if (dateInQuestion <= today) return false;
        
        // Show predicted period for appropriate cycle days
        return cycleDay <= cycle.periodDays;
    }

    /**
     * Check if date falls in fertile window
     */
    private isFertileWindow(cycle: PeriodCycle, cycleDay: number, allCycles?: PeriodCycle[], date?: Date): boolean {
        // Check if date is before first recorded period - no predictions before actual data
        if (date && allCycles && allCycles.length > 0) {
            const firstPeriodDate = this.getFirstRecordedPeriodDate({ cycles: allCycles } as CycleData);
            if (firstPeriodDate && date < firstPeriodDate) {
                return false;
            }
        }
        
        // Use predicted cycle length for current cycle, actual length for historical cycles
        const cycleLength = allCycles ? this.getPredictedCycleLength(allCycles, cycle) : (cycle.cycleLength || 28);
        const ovulationDay = cycleLength - 14;
        return cycleDay >= ovulationDay - 5 && cycleDay <= ovulationDay + 1;
    }

    /**
     * Check if date is predicted ovulation day
     */
    private isOvulationDay(cycle: PeriodCycle, cycleDay: number, allCycles?: PeriodCycle[], date?: Date): boolean {
        // Check if date is before first recorded period - no predictions before actual data
        if (date && allCycles && allCycles.length > 0) {
            const firstPeriodDate = this.getFirstRecordedPeriodDate({ cycles: allCycles } as CycleData);
            if (firstPeriodDate && date < firstPeriodDate) {
                return false;
            }
        }
        
        // Use predicted cycle length for current cycle, actual length for historical cycles
        const cycleLength = allCycles ? this.getPredictedCycleLength(allCycles, cycle) : (cycle.cycleLength || 28);
        const ovulationDay = cycleLength - 14;
        return cycleDay === ovulationDay;
    }

    /**
     * Calculate average cycle length from known cycles
     */
    private calculateAverageCycleLength(cycles: PeriodCycle[]): number {
        const knownLengths = cycles
            .map(c => c.cycleLength)
            .filter((length): length is number => length !== undefined);
        
        if (knownLengths.length === 0) return 28;
        
        const sum = knownLengths.reduce((a, b) => a + b, 0);
        return Math.round(sum / knownLengths.length);
    }

    /**
     * Calculate mean cycle length from the last 3 completed cycles
     * Used for predicting current cycle length when not yet known
     */
    private calculateLast3CyclesMean(cycles: PeriodCycle[], excludeCurrentCycle: boolean = true): number {
        // Get cycles with known lengths, excluding the most recent one if it's the current cycle
        let availableCycles = cycles.filter(c => c.cycleLength !== undefined);
        
        // If excluding current cycle, remove the last cycle from consideration
        if (excludeCurrentCycle && availableCycles.length > 0) {
            // Check if the last cycle in the full cycles array has no cycleLength (indicating it's current)
            const lastCycle = cycles[cycles.length - 1];
            if (lastCycle.cycleLength === undefined) {
                // The last cycle is indeed the current one, so we can use all available cycles
                // (they're already filtered to only include those with known lengths)
            } else {
                // The last cycle has a length, so it's completed. Remove it if we want to exclude current.
                // Actually, we want to exclude the conceptual "current" cycle, which would be
                // any ongoing cycle. Since we're looking for prediction, we use completed cycles.
            }
        }
        
        // Get the last 3 cycles with known lengths
        const last3Cycles = availableCycles.slice(-3);
        
        if (last3Cycles.length === 0) {
            return 28; // Default fallback
        }
        
        const cycleLengths = last3Cycles.map(c => c.cycleLength!); // We know these are defined
        const sum = cycleLengths.reduce((a, b) => a + b, 0);
        return Math.round(sum / cycleLengths.length);
    }

    /**
     * Get predicted cycle length for a specific cycle
     * Uses last 3 cycles mean for current cycle, actual length for historical cycles
     */
    private getPredictedCycleLength(cycles: PeriodCycle[], targetCycle: PeriodCycle): number {
        // If the cycle has a known length, use it
        if (targetCycle.cycleLength !== undefined) {
            return targetCycle.cycleLength;
        }
        
        // Check if this is the current (most recent) cycle
        const isCurrentCycle = cycles.length > 0 && cycles[cycles.length - 1].id === targetCycle.id;
        
        if (isCurrentCycle) {
            // For current cycle, use mean of last 3 cycles
            return this.calculateLast3CyclesMean(cycles, true);
        } else {
            // For historical cycles or projections, use overall average
            return this.calculateAverageCycleLength(cycles);
        }
    }

    /**
     * Calculate date range from symptoms
     */
    private calculateDateRange(symptoms: Map<string, DailySymptoms>): { earliest: Date; latest: Date } {
        const dates = Array.from(symptoms.values()).map(s => s.date);
        dates.sort((a, b) => a.getTime() - b.getTime());
        
        return {
            earliest: dates[0] || new Date(),
            latest: dates[dates.length - 1] || new Date()
        };
    }

    // === UTILITY METHODS ===

    /**
     * Extract symptoms from Dataview page data
     * @param symptom The symptom object to populate
     * @param page Dataview page object
     * @param settings Plugin settings containing property names and tracking flags
     */
    private extractSymptomsFromDataviewPage(
        symptom: DailySymptoms, 
        page: any, 
        settings: CycleTrackerSettings
    ): void {
        // Helper function to get property value from Dataview page
        const getPropertyValue = (propertyName: string): string | null => {
            return page[propertyName] || null;
        };

        // Helper function to get boolean property value from Dataview page
        const getBooleanPropertyValue = (propertyName: string): boolean | null => {
            const value = getPropertyValue(propertyName);
            return value ? this.parseBoolean(value) : null;
        };

        // Physical symptoms
        if (settings.trackPeriodFlow) {
            symptom.periodFlow = getPropertyValue(settings.periodFlowProperty);
        }
        if (settings.trackDischarge) {
            symptom.discharge = getPropertyValue(settings.dischargeProperty);
        }
        if (settings.trackCramps) {
            symptom.cramps = getBooleanPropertyValue(settings.crampsProperty);
        }
        if (settings.trackBloating) {
            symptom.bloating = getBooleanPropertyValue(settings.bloatingProperty);
        }
        if (settings.trackBreastTenderness) {
            symptom.breastTenderness = getBooleanPropertyValue(settings.breastTendernessProperty);
        }
        if (settings.trackHeadaches) {
            symptom.headaches = getBooleanPropertyValue(settings.headachesProperty);
        }
        if (settings.trackBowelChanges) {
            symptom.bowelChanges = getPropertyValue(settings.bowelChangesProperty);
        }
        
        // Emotional and mental state
        if (settings.trackMood) {
            symptom.mood = getPropertyValue(settings.moodProperty);
        }
        if (settings.trackEnergyLevels) {
            symptom.energyLevels = getPropertyValue(settings.energyLevelsProperty);
        }
        if (settings.trackAnxiety) {
            symptom.anxiety = getPropertyValue(settings.anxietyProperty);
        }
        if (settings.trackConcentration) {
            symptom.concentration = getPropertyValue(settings.concentrationProperty);
        }
        if (settings.trackSexDrive) {
            symptom.sexDrive = getPropertyValue(settings.sexDriveProperty);
        }
        
        // Lifestyle factors
        if (settings.trackPhysicalActivity) {
            symptom.physicalActivity = getPropertyValue(settings.physicalActivityProperty);
        }
        if (settings.trackNutrition) {
            symptom.nutrition = getPropertyValue(settings.nutritionProperty);
        }
        if (settings.trackWaterIntake) {
            symptom.waterIntake = getPropertyValue(settings.waterIntakeProperty);
        }
        if (settings.trackAlcoholConsumption) {
            symptom.alcoholConsumption = getPropertyValue(settings.alcoholConsumptionProperty);
        }
        if (settings.trackMedication) {
            symptom.medication = getPropertyValue(settings.medicationProperty);
        }
        if (settings.trackSexualActivity) {
            symptom.sexualActivity = getPropertyValue(settings.sexualActivityProperty);
        }
    }

    private hasDataviewPlugin(): boolean {
        // @ts-ignore
        return this.app.plugins.plugins.dataview !== undefined;
    }

    public formatDateKey(date: Date): string {
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    }

    private daysBetween(date1: Date, date2: Date): number {
        return Math.abs(Math.floor((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24)));
    }

    private escapeRegex(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private validateFolderPath(folderPath: string): string {
        return folderPath.replace(/\.\./g, '').replace(/\/+/g, '/');
    }

    /**
     * Get cached validated folder path or validate and cache it
     */
    private getValidatedFolderPath(): string {
        if (this.validatedFolderPath === null) {
            this.validatedFolderPath = this.validateFolderPath(this.plugin.settings.dailyNotesFolder);
        }
        return this.validatedFolderPath;
    }

    /**
     * Clear the cached folder path (call when settings change)
     */
    public clearFolderPathCache(): void {
        this.validatedFolderPath = null;
    }

    // === DATA LOADING METHODS ===

    private async loadSymptomsWithDataview(
        symptoms: Map<string, DailySymptoms>, 
        settings: CycleTrackerSettings, 
        startDate: Date, 
        endDate: Date
    ): Promise<void> {
        // @ts-ignore
        const dataviewApi = this.app.plugins.plugins.dataview?.api;
        if (!dataviewApi) throw new Error('Dataview not available');

        const validatedFolderPath = this.getValidatedFolderPath();
        let pages;

        try {
            pages = await dataviewApi.pages(`"${validatedFolderPath}"`);
        } catch (queryError) {
            console.log("First query attempt failed, trying fallback query", queryError);
            pages = await dataviewApi.pages(`WHERE contains(file.folder, "${validatedFolderPath}")`);
        }

        if (!pages?.values) return;

        for (const page of pages.values) {
            if (!page) continue;

            const date = this.tryParseDateFromFilename(page.file.name);
            if (!date || date < startDate || date > endDate) continue;

            const symptom = this.createEmptySymptom(date);
            this.extractSymptomsFromPage(symptom, page, settings);
            
            const dateKey = this.formatDateKey(date);
            symptoms.set(dateKey, symptom);
        }
    }

    private createEmptySymptom(date: Date): DailySymptoms {
        return {
            date,
            periodFlow: null,
            discharge: null,
            cramps: null,
            bloating: null,
            breastTenderness: null,
            headaches: null,
            bowelChanges: null,
            mood: null,
            energyLevels: null,
            anxiety: null,
            concentration: null,
            sexDrive: null,
            physicalActivity: null,
            nutrition: null,
            waterIntake: null,
            alcoholConsumption: null,
            medication: null,
            sexualActivity: null
        };
    }

    private extractSymptomsFromPage(symptom: DailySymptoms, page: any, settings: CycleTrackerSettings): void {
        // Use Dataview-specific extraction method
        this.extractSymptomsFromDataviewPage(symptom, page, settings);
    }

    private tryParseDateFromFilename(filename: string): Date | null {
        const dateMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
            const year = parseInt(dateMatch[1]);
            const month = parseInt(dateMatch[2]) - 1;
            const day = parseInt(dateMatch[3]);
            const date = new Date(year, month, day);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
        return null;
    }

    private parseBoolean(value: string | boolean): boolean | null {
        if (typeof value === 'boolean') return value;
        if (typeof value !== 'string') return null;
        
        const lowerValue = value.toLowerCase().trim();
        if (['yes', 'true', 'y', '1', 'on', 'checked'].includes(lowerValue)) return true;
        if (['no', 'false', 'n', '0', 'off', 'unchecked'].includes(lowerValue)) return false;
        return null;
    }


}
