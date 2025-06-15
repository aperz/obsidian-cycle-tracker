import { App, TFile } from 'obsidian';
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
            isFertileWindow: this.isFertileWindow(cycle, cycleDay, data.cycles),
            isOvulationDay: this.isOvulationDay(cycle, cycleDay, data.cycles)
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
     * Get the first recorded period date (Day 1 of first cycle)
     */
    getFirstRecordedPeriodDate(data: CycleData): Date | null {
        if (data.cycles.length === 0) return null;
        
        // Find the earliest cycle start date
        const sortedCycles = [...data.cycles].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
        return sortedCycles[0].startDate;
    }

    // === PRIVATE IMPLEMENTATION ===

    /**
     * Load raw symptom data from daily notes (no cycle calculations)
     */
    private async loadRawSymptoms(settings: CycleTrackerSettings, months: number): Promise<Map<string, DailySymptoms>> {
        const symptoms = new Map<string, DailySymptoms>();
        
        // Date range for loading
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);
        
        try {
            // Try Dataview first, fall back to manual
            if (this.hasDataviewPlugin()) {
                await this.loadSymptomsWithDataview(symptoms, settings, startDate, endDate);
            } else {
                await this.loadSymptomsManually(symptoms, settings, startDate, endDate);
            }
        } catch (error) {
            console.error('Error loading symptoms:', error);
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
    private isFertileWindow(cycle: PeriodCycle, cycleDay: number, allCycles?: PeriodCycle[]): boolean {
        // Use predicted cycle length for current cycle, actual length for historical cycles
        const cycleLength = allCycles ? this.getPredictedCycleLength(allCycles, cycle) : (cycle.cycleLength || 28);
        const ovulationDay = cycleLength - 14;
        return cycleDay >= ovulationDay - 5 && cycleDay <= ovulationDay + 1;
    }

    /**
     * Check if date is predicted ovulation day
     */
    private isOvulationDay(cycle: PeriodCycle, cycleDay: number, allCycles?: PeriodCycle[]): boolean {
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

    private hasDataviewPlugin(): boolean {
        // @ts-ignore
        return this.app.plugins.plugins.dataview !== undefined;
    }

    private formatDateKey(date: Date): string {
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

        const validatedFolderPath = this.validateFolderPath(this.plugin.settings.dailyNotesFolder);
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

    private async loadSymptomsManually(
        symptoms: Map<string, DailySymptoms>, 
        settings: CycleTrackerSettings, 
        startDate: Date, 
        endDate: Date
    ): Promise<void> {
        const dailyNotes = await this.getDailyNotes(startDate, endDate);

        for (const file of dailyNotes) {
            const date = this.tryParseDateFromFilename(file.basename);
            if (!date) continue;

            const content = await this.app.vault.read(file);
            const symptom = this.createEmptySymptom(date);
            this.extractSymptomsFromContent(symptom, content, settings);
            
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
        // Physical symptoms
        if (settings.trackPeriodFlow && page[settings.periodFlowProperty]) {
            symptom.periodFlow = page[settings.periodFlowProperty];
        }
        if (settings.trackDischarge && page[settings.dischargeProperty]) {
            symptom.discharge = page[settings.dischargeProperty];
        }
        if (settings.trackCramps && page[settings.crampsProperty]) {
            symptom.cramps = this.parseBoolean(page[settings.crampsProperty]);
        }
        if (settings.trackBloating && page[settings.bloatingProperty]) {
            symptom.bloating = this.parseBoolean(page[settings.bloatingProperty]);
        }
        if (settings.trackBreastTenderness && page[settings.breastTendernessProperty]) {
            symptom.breastTenderness = this.parseBoolean(page[settings.breastTendernessProperty]);
        }
        if (settings.trackHeadaches && page[settings.headachesProperty]) {
            symptom.headaches = this.parseBoolean(page[settings.headachesProperty]);
        }
        if (settings.trackBowelChanges && page[settings.bowelChangesProperty]) {
            symptom.bowelChanges = page[settings.bowelChangesProperty];
        }
        
        // Emotional and mental state
        if (settings.trackMood && page[settings.moodProperty]) {
            symptom.mood = page[settings.moodProperty];
        }
        if (settings.trackEnergyLevels && page[settings.energyLevelsProperty]) {
            symptom.energyLevels = page[settings.energyLevelsProperty];
        }
        if (settings.trackAnxiety && page[settings.anxietyProperty]) {
            symptom.anxiety = page[settings.anxietyProperty];
        }
        if (settings.trackConcentration && page[settings.concentrationProperty]) {
            symptom.concentration = page[settings.concentrationProperty];
        }
        if (settings.trackSexDrive && page[settings.sexDriveProperty]) {
            symptom.sexDrive = page[settings.sexDriveProperty];
        }
        
        // Lifestyle factors
        if (settings.trackPhysicalActivity && page[settings.physicalActivityProperty]) {
            symptom.physicalActivity = page[settings.physicalActivityProperty];
        }
        if (settings.trackNutrition && page[settings.nutritionProperty]) {
            symptom.nutrition = page[settings.nutritionProperty];
        }
        if (settings.trackWaterIntake && page[settings.waterIntakeProperty]) {
            symptom.waterIntake = page[settings.waterIntakeProperty];
        }
        if (settings.trackAlcoholConsumption && page[settings.alcoholConsumptionProperty]) {
            symptom.alcoholConsumption = page[settings.alcoholConsumptionProperty];
        }
        if (settings.trackMedication && page[settings.medicationProperty]) {
            symptom.medication = page[settings.medicationProperty];
        }
        if (settings.trackSexualActivity && page[settings.sexualActivityProperty]) {
            symptom.sexualActivity = page[settings.sexualActivityProperty];
        }
    }

    private extractSymptomsFromContent(symptom: DailySymptoms, content: string, settings: CycleTrackerSettings): void {
        // Physical symptoms
        if (settings.trackPeriodFlow) {
            symptom.periodFlow = this.extractProperty(content, settings.periodFlowProperty);
        }
        if (settings.trackDischarge) {
            symptom.discharge = this.extractProperty(content, settings.dischargeProperty);
        }
        if (settings.trackCramps) {
            const crampsValue = this.extractProperty(content, settings.crampsProperty);
            symptom.cramps = crampsValue ? this.parseBoolean(crampsValue) : null;
        }
        if (settings.trackBloating) {
            const bloatingValue = this.extractProperty(content, settings.bloatingProperty);
            symptom.bloating = bloatingValue ? this.parseBoolean(bloatingValue) : null;
        }
        if (settings.trackBreastTenderness) {
            const breastTendernessValue = this.extractProperty(content, settings.breastTendernessProperty);
            symptom.breastTenderness = breastTendernessValue ? this.parseBoolean(breastTendernessValue) : null;
        }
        if (settings.trackHeadaches) {
            const headachesValue = this.extractProperty(content, settings.headachesProperty);
            symptom.headaches = headachesValue ? this.parseBoolean(headachesValue) : null;
        }
        if (settings.trackBowelChanges) {
            symptom.bowelChanges = this.extractProperty(content, settings.bowelChangesProperty);
        }
        
        // Emotional and mental state
        if (settings.trackMood) {
            symptom.mood = this.extractProperty(content, settings.moodProperty);
        }
        if (settings.trackEnergyLevels) {
            symptom.energyLevels = this.extractProperty(content, settings.energyLevelsProperty);
        }
        if (settings.trackAnxiety) {
            symptom.anxiety = this.extractProperty(content, settings.anxietyProperty);
        }
        if (settings.trackConcentration) {
            symptom.concentration = this.extractProperty(content, settings.concentrationProperty);
        }
        if (settings.trackSexDrive) {
            symptom.sexDrive = this.extractProperty(content, settings.sexDriveProperty);
        }
        
        // Lifestyle factors
        if (settings.trackPhysicalActivity) {
            symptom.physicalActivity = this.extractProperty(content, settings.physicalActivityProperty);
        }
        if (settings.trackNutrition) {
            symptom.nutrition = this.extractProperty(content, settings.nutritionProperty);
        }
        if (settings.trackWaterIntake) {
            symptom.waterIntake = this.extractProperty(content, settings.waterIntakeProperty);
        }
        if (settings.trackAlcoholConsumption) {
            symptom.alcoholConsumption = this.extractProperty(content, settings.alcoholConsumptionProperty);
        }
        if (settings.trackMedication) {
            symptom.medication = this.extractProperty(content, settings.medicationProperty);
        }
        if (settings.trackSexualActivity) {
            symptom.sexualActivity = this.extractProperty(content, settings.sexualActivityProperty);
        }
    }

    private extractProperty(content: string, propertyName: string): string | null {
        const escapedProperty = this.escapeRegex(propertyName);
        
        // YAML front matter format
        const yamlRegex = new RegExp(`${escapedProperty}:\\s*(.+?)(?:$|\\n)`, 'i');
        const yamlMatch = content.match(yamlRegex);
        if (yamlMatch && yamlMatch[1]) {
            return yamlMatch[1].trim();
        }
        
        // Dataview inline format
        const inlineRegex = new RegExp(`${escapedProperty}::(.+?)(?:$|\\n)`, 'i');
        const inlineMatch = content.match(inlineRegex);
        if (inlineMatch && inlineMatch[1]) {
            return inlineMatch[1].trim();
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

    private async getDailyNotes(startDate: Date, endDate: Date): Promise<TFile[]> {
        const dailyNotes: TFile[] = [];
        const files = this.app.vault.getMarkdownFiles();
        const dailyNotesFolder = this.validateFolderPath(this.plugin.settings.dailyNotesFolder);
        
        for (const file of files) {
            const filePath = file.path;
            const isInDailyNotesFolder = filePath.startsWith(dailyNotesFolder + '/');
            
            if (isInDailyNotesFolder) {
                const fileDate = this.tryParseDateFromFilename(file.basename);
                if (fileDate && fileDate >= startDate && fileDate <= endDate) {
                    dailyNotes.push(file);
                }
            }
        }
        
        return dailyNotes;
    }
}
