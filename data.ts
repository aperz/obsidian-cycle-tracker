import { App, TFile } from 'obsidian';
import type CycleTracker from './main';
import type { CycleTrackerSettings } from './settings';

// Define interfaces for the data structures
export interface CycleData {
    lastPeriodStart: Date | null;
    periodDuration: number;
    cycleLength: number;
    symptoms: DailySymptoms[];
}

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

export class DataHandler {
    app: App;
    plugin: CycleTracker;
    
    constructor(app: App, plugin: CycleTracker) {
        this.app = app;
        this.plugin = plugin;
    }
    
    /**
     * Check if Dataview plugin is available
     */
    hasDataviewPlugin(): boolean {
        // @ts-ignore
        return this.app.plugins.plugins.dataview !== undefined;
    }
    
    /**
     * Get all daily notes in a specified date range
     */
    async getDailyNotes(startDate: Date, endDate: Date): Promise<TFile[]> {
        const dailyNotes: TFile[] = [];
        const files = this.app.vault.getMarkdownFiles();
        const dailyNotesFolder = this.plugin.settings.dailyNotesFolder;
        
        // Filter files that look like daily notes based on naming convention and location
        for (const file of files) {
            // Check if file is in the daily notes folder
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
    
    /**
     * Try to parse a date from a filename
     * Supports formats like 2023-05-01, 2023-05-01-Monday, etc.
     */
    tryParseDateFromFilename(filename: string): Date | null {
        // Try to match YYYY-MM-DD pattern
        const dateMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
            const year = parseInt(dateMatch[1]);
            const month = parseInt(dateMatch[2]) - 1; // JS months are 0-indexed
            const day = parseInt(dateMatch[3]);
            
            const date = new Date(year, month, day);
            // Verify this is a valid date
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
        
        return null;
    }
    
    /**
     * Get cycle data from daily notes
     */
    async getCycleData(settings: CycleTrackerSettings, months: number = 3): Promise<CycleData> {
        // Start date is X months ago
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);
        
        // End date is today
        const endDate = new Date();
        
        // Initialize empty result
        const result: CycleData = {
            lastPeriodStart: null,
            periodDuration: 5, // Default to 5 days
            cycleLength: 28, // Default to 28 days
            symptoms: []
        };
        
        try {
            if (this.hasDataviewPlugin()) {
                console.log(`Attempting to get cycle data with Dataview...`);
                return await this.getCycleDataWithDataview(settings, startDate, endDate);
            } else {
                console.log(`Dataview method failed. Attempting to get cycle data manually...`);
                return await this.getCycleDataManually(settings, startDate, endDate);
            }
        } catch (error) {
            console.error("Error getting cycle data:", error);
            return result;
        }
    }
    
    /**
     * Get cycle data using the Dataview plugin
     */
    async getCycleDataWithDataview(settings: CycleTrackerSettings, startDate: Date, endDate: Date): Promise<CycleData> {
        const result: CycleData = {
            lastPeriodStart: null,
            periodDuration: 5,
            cycleLength: 28,
            symptoms: []
        };
        
        // Use Dataview API to get data
        // @ts-ignore
        const dataviewApi = this.app.plugins.plugins.dataview?.api;
        
        if (!dataviewApi) {
            return result;
        }
        
        // Format dates for dataview query
        const startDateStr = `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}-${startDate.getDate().toString().padStart(2, '0')}`;
        const endDateStr = `${endDate.getFullYear()}-${(endDate.getMonth() + 1).toString().padStart(2, '0')}-${endDate.getDate().toString().padStart(2, '0')}`;
        
        try {
            // Get files from the daily notes folder using a proper Dataview query
            let pages;
            try {
                // First try with the folder path directly
                pages = await dataviewApi.pages(`"${this.plugin.settings.dailyNotesFolder}"`);
            } catch (queryError) {
                console.log("First query attempt failed, trying fallback query", queryError);
                // If that fails, try with a WHERE clause as a fallback
                pages = await dataviewApi.pages(`WHERE contains(file.folder, "${this.plugin.settings.dailyNotesFolder}")`);
            }
            
            // Process the data
            if (pages && pages.values && pages.values.length > 0) {
            console.log(`Found ${pages.values.length} pages in the daily notes folder`);
            for (const page of pages.values) {
                try {
                    if (!page) continue;
                    
                    // Try to extract date from filename
                    const date = this.tryParseDateFromFilename(page.file.name);
                    if (!date) continue;
                    
                    // Check if date is within our range
                    if (date < startDate || date > endDate) continue;
                    
                    // Create a daily symptoms entry
                    const symptoms: DailySymptoms = {
                        date: date,
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
                    
                    // Extract properties based on settings
                    if (settings.trackPeriodFlow && page[settings.periodFlowProperty]) {
                        symptoms.periodFlow = page[settings.periodFlowProperty];
                        
                        // If this is a period start (not none/empty) and it's the most recent, update lastPeriodStart
                        if (symptoms.periodFlow && 
                            symptoms.periodFlow.toLowerCase() !== "none" && 
                            (!result.lastPeriodStart || date > result.lastPeriodStart)) {
                            result.lastPeriodStart = date;
                        }
                    }
                    
                    // Extract all other properties
                    if (settings.trackDischarge && page[settings.dischargeProperty]) {
                        symptoms.discharge = page[settings.dischargeProperty];
                    }
                    
                    if (settings.trackCramps && page[settings.crampsProperty]) {
                        symptoms.cramps = this.parseBoolean(page[settings.crampsProperty]);
                    }
                    
                    if (settings.trackBloating && page[settings.bloatingProperty]) {
                        symptoms.bloating = this.parseBoolean(page[settings.bloatingProperty]);
                    }
                    
                    if (settings.trackBreastTenderness && page[settings.breastTendernessProperty]) {
                        symptoms.breastTenderness = this.parseBoolean(page[settings.breastTendernessProperty]);
                    }
                    
                    if (settings.trackHeadaches && page[settings.headachesProperty]) {
                        symptoms.headaches = this.parseBoolean(page[settings.headachesProperty]);
                    }
                    
                    if (settings.trackBowelChanges && page[settings.bowelChangesProperty]) {
                        symptoms.bowelChanges = page[settings.bowelChangesProperty];
                    }
                    
                    if (settings.trackMood && page[settings.moodProperty]) {
                        symptoms.mood = page[settings.moodProperty];
                    }
                    
                    if (settings.trackEnergyLevels && page[settings.energyLevelsProperty]) {
                        symptoms.energyLevels = page[settings.energyLevelsProperty];
                    }
                    
                    if (settings.trackAnxiety && page[settings.anxietyProperty]) {
                        symptoms.anxiety = page[settings.anxietyProperty];
                    }
                    
                    if (settings.trackConcentration && page[settings.concentrationProperty]) {
                        symptoms.concentration = page[settings.concentrationProperty];
                    }
                    
                    if (settings.trackSexDrive && page[settings.sexDriveProperty]) {
                        symptoms.sexDrive = page[settings.sexDriveProperty];
                    }
                    
                    if (settings.trackPhysicalActivity && page[settings.physicalActivityProperty]) {
                        symptoms.physicalActivity = page[settings.physicalActivityProperty];
                    }
                    
                    if (settings.trackNutrition && page[settings.nutritionProperty]) {
                        symptoms.nutrition = page[settings.nutritionProperty];
                    }
                    
                    if (settings.trackWaterIntake && page[settings.waterIntakeProperty]) {
                        symptoms.waterIntake = page[settings.waterIntakeProperty];
                    }
                    
                    if (settings.trackAlcoholConsumption && page[settings.alcoholConsumptionProperty]) {
                        symptoms.alcoholConsumption = page[settings.alcoholConsumptionProperty];
                    }
                    
                    if (settings.trackMedication && page[settings.medicationProperty]) {
                        symptoms.medication = page[settings.medicationProperty];
                    }
                    
                    if (settings.trackSexualActivity && page[settings.sexualActivityProperty]) {
                        symptoms.sexualActivity = page[settings.sexualActivityProperty];
                    }
                    
                    // Add to the list
                    result.symptoms.push(symptoms);
                } catch (pageError) {
                    console.error("Error processing page:", page?.file?.name, pageError);
                    // Continue with the next page
                    continue;
                }
            }
        }
        } catch (error) {
            console.error("Dataview query error:", error);
            console.log("All Dataview queries failed, falling back to manual file reading method");
            // Fallback to manual method
            return this.getCycleDataManually(settings, startDate, endDate);
        }
        
        // Calculate periodDuration and cycleLength if we have enough data
        if (result.lastPeriodStart && result.symptoms.length > 0) {
            this.calculateCycleMetrics(result);
        }
        
        return result;
    }
    
    /**
     * Get cycle data manually by reading daily notes contents
     */
    async getCycleDataManually(settings: CycleTrackerSettings, startDate: Date, endDate: Date): Promise<CycleData> {
        const result: CycleData = {
            lastPeriodStart: null,
            periodDuration: 5,
            cycleLength: 28,
            symptoms: []
        };
        
        // Get all daily notes in the range
        const dailyNotes = await this.getDailyNotes(startDate, endDate);
        
        // Process each daily note
        for (const file of dailyNotes) {
            const date = this.tryParseDateFromFilename(file.basename);
            if (!date) continue;
            
            // Read file content
            const content = await this.app.vault.read(file);
            
            // Create a daily symptoms entry
            const symptoms: DailySymptoms = {
                date: date,
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
            
            // Extract properties from content using regex
            if (settings.trackPeriodFlow) {
                symptoms.periodFlow = this.extractProperty(content, settings.periodFlowProperty);
                
                // If this is a period start (not none/empty) and it's the most recent, update lastPeriodStart
                if (symptoms.periodFlow && 
                    symptoms.periodFlow.toLowerCase() !== "none" && 
                    (!result.lastPeriodStart || date > result.lastPeriodStart)) {
                    result.lastPeriodStart = date;
                }
            }
            
            // Extract all other properties
            if (settings.trackDischarge) {
                symptoms.discharge = this.extractProperty(content, settings.dischargeProperty);
            }
            
            if (settings.trackCramps) {
                const value = this.extractProperty(content, settings.crampsProperty);
                symptoms.cramps = value ? this.parseBoolean(value) : null;
            }
            
            if (settings.trackBloating) {
                const value = this.extractProperty(content, settings.bloatingProperty);
                symptoms.bloating = value ? this.parseBoolean(value) : null;
            }
            
            if (settings.trackBreastTenderness) {
                const value = this.extractProperty(content, settings.breastTendernessProperty);
                symptoms.breastTenderness = value ? this.parseBoolean(value) : null;
            }
            
            if (settings.trackHeadaches) {
                const value = this.extractProperty(content, settings.headachesProperty);
                symptoms.headaches = value ? this.parseBoolean(value) : null;
            }
            
            if (settings.trackBowelChanges) {
                symptoms.bowelChanges = this.extractProperty(content, settings.bowelChangesProperty);
            }
            
            if (settings.trackMood) {
                symptoms.mood = this.extractProperty(content, settings.moodProperty);
            }
            
            if (settings.trackEnergyLevels) {
                symptoms.energyLevels = this.extractProperty(content, settings.energyLevelsProperty);
            }
            
            if (settings.trackAnxiety) {
                symptoms.anxiety = this.extractProperty(content, settings.anxietyProperty);
            }
            
            if (settings.trackConcentration) {
                symptoms.concentration = this.extractProperty(content, settings.concentrationProperty);
            }
            
            if (settings.trackSexDrive) {
                symptoms.sexDrive = this.extractProperty(content, settings.sexDriveProperty);
            }
            
            if (settings.trackPhysicalActivity) {
                symptoms.physicalActivity = this.extractProperty(content, settings.physicalActivityProperty);
            }
            
            if (settings.trackNutrition) {
                symptoms.nutrition = this.extractProperty(content, settings.nutritionProperty);
            }
            
            if (settings.trackWaterIntake) {
                symptoms.waterIntake = this.extractProperty(content, settings.waterIntakeProperty);
            }
            
            if (settings.trackAlcoholConsumption) {
                symptoms.alcoholConsumption = this.extractProperty(content, settings.alcoholConsumptionProperty);
            }
            
            if (settings.trackMedication) {
                symptoms.medication = this.extractProperty(content, settings.medicationProperty);
            }
            
            if (settings.trackSexualActivity) {
                symptoms.sexualActivity = this.extractProperty(content, settings.sexualActivityProperty);
            }
            
            // Add to the list if we found any symptoms
            if (Object.values(symptoms).some(v => v !== null && v !== undefined && v !== date)) {
                result.symptoms.push(symptoms);
            }
        }
        
        // Sort symptoms by date
        result.symptoms.sort((a, b) => a.date.getTime() - b.date.getTime());
        
        // Calculate period duration and cycle length using same logic as in dataview method
        if (result.lastPeriodStart && result.symptoms.length > 0) {
            this.calculateCycleMetrics(result);
        }
        
        return result;
    }
    
    /**
     * Escape special regex characters to prevent regex injection attacks
     */
    private escapeRegex(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    /**
     * Extract a property value from note content
     * Uses escaped regex patterns to prevent injection attacks
     */
    extractProperty(content: string, propertyName: string): string | null {
        // Try various property formats:
        // Escape the property name to prevent regex injection attacks
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
        
        // Property in table format
        const tableRegex = new RegExp(`\\|\\s*${escapedProperty}\\s*\\|\\s*(.+?)\\s*\\|`, 'i');
        const tableMatch = content.match(tableRegex);
        if (tableMatch && tableMatch[1]) {
            return tableMatch[1].trim();
        }
        
        return null;
    }
    
    /**
     * Calculate period duration and cycle length metrics for cycle data
     * Extracts common calculation logic used by both data extraction methods
     */
    private calculateCycleMetrics(result: CycleData): void {
        if (!result.lastPeriodStart || result.symptoms.length === 0) {
            return;
        }
        
        // Sort symptoms by date for chronological processing
        const sortedSymptoms = [...result.symptoms].sort((a, b) => a.date.getTime() - b.date.getTime());
        
        // Calculate period duration
        result.periodDuration = this.calculatePeriodDuration(result.lastPeriodStart, sortedSymptoms);
        
        // Calculate cycle length
        result.cycleLength = this.calculateCycleLength(result.lastPeriodStart, sortedSymptoms);
    }
    
    /**
     * Calculate period duration by counting consecutive days with period flow from the last period start
     */
    private calculatePeriodDuration(lastPeriodStart: Date, sortedSymptoms: DailySymptoms[]): number {
        // Find the last period start in the sorted list
        const lastPeriodStartIndex = sortedSymptoms.findIndex(s => 
            s.date.getTime() === lastPeriodStart.getTime()
        );
        
        if (lastPeriodStartIndex < 0) {
            return 5; // Default fallback
        }
        
        // Count consecutive days with period flow starting from the last period start
        let periodDuration = 0;
        for (let i = lastPeriodStartIndex; i < sortedSymptoms.length; i++) {
            if (sortedSymptoms[i].periodFlow && 
                sortedSymptoms[i].periodFlow?.toLowerCase() !== "none") {
                periodDuration++;
            } else {
                break; // Stop at first non-period day
            }
        }
        
        // Return calculated duration or default to 5 days if no period flow found
        return periodDuration > 0 ? periodDuration : 5;
    }
    
    /**
     * Calculate cycle length by finding the previous period start and measuring days between cycles
     */
    private calculateCycleLength(lastPeriodStart: Date, sortedSymptoms: DailySymptoms[]): number {
        // Get all dates with period flow (potential period start dates)
        const allPeriodStarts = sortedSymptoms
            .filter(s => s.periodFlow && s.periodFlow.toLowerCase() !== "none")
            .map(s => s.date);
        
        // Need at least 2 periods to calculate cycle length
        if (allPeriodStarts.length < 2) {
            return 28; // Default cycle length
        }
        
        // Find the most recent period start before the last one
        let previousPeriodStart = null;
        for (let i = allPeriodStarts.length - 2; i >= 0; i--) {
            // Check if this is the start of a period (previous day has no period)
            const currentDay = allPeriodStarts[i];
            const previousDay = new Date(currentDay);
            previousDay.setDate(previousDay.getDate() - 1);
            
            // Check if previous day exists in our data and has no period
            const previousDayData = sortedSymptoms.find(s => 
                s.date.getFullYear() === previousDay.getFullYear() &&
                s.date.getMonth() === previousDay.getMonth() &&
                s.date.getDate() === previousDay.getDate()
            );
            
            // This is a period start if the previous day has no period data or no period flow
            if (!previousDayData || 
                !previousDayData.periodFlow || 
                previousDayData.periodFlow.toLowerCase() === "none") {
                previousPeriodStart = currentDay;
                break;
            }
        }
        
        // Calculate cycle length if we found a previous period start
        if (previousPeriodStart) {
            const daysBetween = Math.round(
                (lastPeriodStart.getTime() - previousPeriodStart.getTime()) / 
                (1000 * 60 * 60 * 24)
            );
            
            // Validate cycle length is within reasonable range
            if (daysBetween > 0 && daysBetween >= 18 && daysBetween <= 40) {
                return daysBetween;
            } else if (daysBetween > 0) {
                // Log warning about unusual cycle length but don't use it
                console.warn(`Calculated cycle length (${daysBetween} days) is outside typical range. Using default.`);
            }
        }
        
        // Return default cycle length if calculation failed or was outside normal range
        return 28;
    }
    
    /**
     * Parse boolean value from various string formats
     */
    parseBoolean(value: string | boolean): boolean | null {
        if (typeof value === 'boolean') {
            return value;
        }
        
        if (typeof value !== 'string') {
            return null;
        }
        
        const lowerValue = value.toLowerCase().trim();
        
        // Consider various truthy values
        if (['yes', 'true', 'y', '1', 'on', 'checked'].includes(lowerValue)) {
            return true;
        }
        
        // Consider various falsy values
        if (['no', 'false', 'n', '0', 'off', 'unchecked'].includes(lowerValue)) {
            return false;
        }
        
        return null;
    }
}
