import { ItemView, WorkspaceLeaf, Modal } from 'obsidian';
import type CycleTracker from './main';
import { DailySymptoms } from './data';

export const VIEW_TYPE_CYCLE_TRACKER = "cycle-tracker-view";

/**
 * Modal for displaying raw cycle data
 */
class RawDataModal extends Modal {
    data: any;
    
    constructor(app: any, data: any) {
        super(app);
        this.data = data;
    }
    
    onOpen() {
        const {contentEl} = this;
        contentEl.empty();
        
        // Add title
        contentEl.createEl('h2', {text: 'Raw Cycle Data'});
        
        // Add explanation
        contentEl.createEl('p', {
            text: 'This is the raw data used by the Cycle Tracker plugin. You can copy this for backup or debugging purposes.'
        });
        
        // Create container for the JSON data
        const dataContainer = contentEl.createDiv({
            cls: 'raw-data-container'
        });
        
        // Format and display data
        const formattedData = this.formatData(this.data);
        const pre = dataContainer.createEl('pre');
        pre.createEl('code', {text: formattedData});
        
        // Add copy button
        const copyButton = contentEl.createEl('button', {
            text: 'Copy to Clipboard',
            cls: 'copy-data-button'
        });
        
        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(formattedData).then(() => {
                copyButton.setText('Copied!');
                setTimeout(() => {
                    copyButton.setText('Copy to Clipboard');
                }, 2000);
            });
        });
    }
    
    formatData(data: any): string {
        // Create a cleaned copy of the data with formatted dates
        const cleanData = this.prepareDataForDisplay(data);
        return JSON.stringify(cleanData, null, 2);
    }
    
    prepareDataForDisplay(data: any): any {
        // Deep copy the object
        const result = JSON.parse(JSON.stringify(data, (key, value) => {
            // Convert Date objects to ISO strings
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value;
        }));
        
        // Format symptoms dates
        if (result.symptoms && Array.isArray(result.symptoms)) {
            result.symptoms.forEach((symptom: any) => {
                if (symptom.date) {
                    // Format as readable date
                    symptom.dateFormatted = new Date(symptom.date).toDateString();
                }
            });
        }
        
        return result;
    }
    
    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

export class CycleTrackerView extends ItemView {
    plugin: CycleTracker;
    currentDisplayMonth: Date;
    selectedDate: Date | null;
    cycleData: any;

    constructor(leaf: WorkspaceLeaf, plugin: CycleTracker) {
        super(leaf);
        this.plugin = plugin;
        this.currentDisplayMonth = new Date();
        this.selectedDate = null; // Initialize selected date as null
        this.cycleData = null; // Initialize cycle data
    }

    getViewType(): string {
        return VIEW_TYPE_CYCLE_TRACKER;
    }

    getDisplayText(): string {
        return "Cycle Tracker";
    }

    getIcon(): string {
        return "cycle-tracker";
    }

    async onOpen() {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass("cycle-tracker-view");

        // Create the main view structure
        this.renderMainView(container);
    }

    async renderMainView(container: HTMLElement) {
        // Get cycle data from the plugin
        this.cycleData = await this.plugin.getCycleData();
        
        // Create header with view raw data button
        const headerContainer = container.createDiv({ cls: "header-container" });
        const header = headerContainer.createEl("h2", { text: "Cycle Tracker" });
        
        // Add a button to view raw data
        const viewDataButton = headerContainer.createEl("button", {
            cls: "view-data-button",
            text: "View Raw Data"
        });
        
        viewDataButton.addEventListener("click", () => {
            // Open modal with raw data
            const modal = new RawDataModal(this.app, this.cycleData);
            modal.open();
        });
        
        // Create sections only if we have valid data
        if (this.cycleData) {
            // If no date is selected yet, default to today
            if (!this.selectedDate) {
                this.selectedDate = new Date();
            }

            // Create cycle overview section
            this.renderCycleOverview(container, this.cycleData, this.selectedDate);

            // Create calendar section
            this.renderCalendar(container, this.cycleData);
            
            // Create symptom sections for the selected date
            this.renderSymptomSections(container, this.cycleData, this.selectedDate);
        } else {
            // Display message when no data is available
            container.createDiv({
                cls: "no-data-message",
                text: "No cycle data available. Add period data to your daily notes to get started."
            });
        }
    }

    /**
     * Calculate cycle predictions for a given date
     * Centralizes prediction logic for phase, fertile window, ovulation, and next period
     */
    calculateCyclePredictions(cycleData: any, date: Date) {
        const predictions = {
            daysSinceLastPeriod: 0,
            cycleDay: 0,
            phase: "Unknown phase",
            isFertileWindow: false,
            isOvulation: false,
            nextPeriodDate: null as Date | null,
            daysToNextPeriod: 0,
            isPredictionValid: true // Flag to indicate if prediction should be shown
        };
        
        if (!cycleData.lastPeriodStart) {
            return predictions;
        }
        
        // Don't predict before the first observation
        if (date < cycleData.lastPeriodStart) {
            predictions.isPredictionValid = false;
            return predictions;
        }
        
        // Calculate days since last period
        const lastPeriod = cycleData.lastPeriodStart;
        predictions.daysSinceLastPeriod = Math.floor((date.getTime() - lastPeriod.getTime()) / (1000 * 60 * 60 * 24));
        
        // Calculate cycle day position (normalize to handle past and future dates)
        predictions.cycleDay = ((predictions.daysSinceLastPeriod % cycleData.cycleLength) + cycleData.cycleLength) % cycleData.cycleLength;
        
        // Determine cycle phase
        if (predictions.cycleDay < cycleData.periodDuration) {
            predictions.phase = "Menstrual Phase";
        } else if (predictions.cycleDay < 13) {
            predictions.phase = "Follicular Phase";
        } else if (predictions.cycleDay < 17) {
            predictions.phase = "Ovulation Phase";
        } else {
            predictions.phase = "Luteal Phase";
        }
        
        // Calculate ovulation day and fertile window
        const ovulationDay = Math.max(cycleData.cycleLength - 14, 0);
        const fertileStart = Math.max(ovulationDay - 5, 0);
        const fertileEnd = ovulationDay + 2;
        
        // Set fertile window and ovulation flags
        predictions.isFertileWindow = (predictions.cycleDay >= fertileStart && predictions.cycleDay <= fertileEnd);
        predictions.isOvulation = (predictions.cycleDay === ovulationDay);
        
        // Calculate next period date and days until next period
        predictions.nextPeriodDate = new Date(lastPeriod);
        predictions.nextPeriodDate.setDate(lastPeriod.getDate() + cycleData.cycleLength);
        
        // If the current date is after the next predicted period, calculate the next one
        while (predictions.nextPeriodDate < date) {
            predictions.nextPeriodDate.setDate(predictions.nextPeriodDate.getDate() + cycleData.cycleLength);
        }
        
        // Calculate days to next period
        predictions.daysToNextPeriod = Math.floor((predictions.nextPeriodDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        
        return predictions;
    }

    renderCycleOverview(container: HTMLElement, cycleData: any, selectedDate: Date) {
        const overviewSection = container.createDiv({ cls: "cycle-overview" });
        
        // Check if we have valid cycle data
        if (cycleData.lastPeriodStart) {
            // Get cycle predictions for the selected date
            const predictions = this.calculateCyclePredictions(cycleData, selectedDate);
            
            // Check if selected date has actual period data
            const selectedDateSymptoms = cycleData.symptoms.find((s: any) => 
                s.date.getDate() === selectedDate.getDate() &&
                s.date.getMonth() === selectedDate.getMonth() &&
                s.date.getFullYear() === selectedDate.getFullYear()
            );
            
            // Display days counter - only if prediction is valid
            if (predictions.isPredictionValid) {
                overviewSection.createDiv({ 
                    cls: "cycle-day-counter",
                    text: `Day ${predictions.daysSinceLastPeriod} of cycle`
                });
            }
            
            // Display selected date
            overviewSection.createDiv({
                cls: "selected-date",
                text: selectedDate.toLocaleDateString('default', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
            });
            
            // Display current phase - only if prediction is valid
            if (predictions.isPredictionValid) {
                overviewSection.createDiv({ 
                    cls: "cycle-phase",
                    text: predictions.phase
                });
            }
            
            // Display recorded period information if available
            if (selectedDateSymptoms?.periodFlow && 
                selectedDateSymptoms.periodFlow.toLowerCase() !== "none") {
                overviewSection.createDiv({ 
                    cls: "recorded-period",
                    text: `Recorded period: ${selectedDateSymptoms.periodFlow}`
                });
            }
            
            // Only show next period prediction if viewing today's date and prediction is valid
            const today = new Date();
            if (predictions.isPredictionValid && 
                selectedDate.getDate() === today.getDate() &&
                selectedDate.getMonth() === today.getMonth() &&
                selectedDate.getFullYear() === today.getFullYear()) {

                // Check if predicted next period is within 16 days of an actual recorded period
                const nextPeriodDate = predictions.nextPeriodDate;
                const isCloseToActualPeriod = nextPeriodDate ? 
                    this.isWithinDaysOfActualPeriod(nextPeriodDate, cycleData.symptoms, 16) : false;
                
                // Only show predicted next period if it's not close to an actual period
                if (!isCloseToActualPeriod && nextPeriodDate) {
                    overviewSection.createDiv({
                        text: `Next period expected in ${predictions.daysToNextPeriod} days`
                    });
                }
            }
            
            // If we're looking at a date before the first observation, show a message
            if (!predictions.isPredictionValid) {
                overviewSection.createDiv({
                    cls: "no-prediction",
                    text: "No cycle data available for this date (before first recorded period)"
                });
            }
        } else {
            // Display message when no cycle data is available
            overviewSection.createDiv({
                cls: "cycle-day-counter",
                text: "No cycle data available"
            });
            
            overviewSection.createDiv({
                text: "Add period information to your daily notes to get started"
            });
        }
    }

    renderCalendar(container: HTMLElement, cycleData: any) {
        const calendarSection = container.createDiv({ cls: "cycle-calendar" });
        
        // Create calendar header with month and navigation
        const calendarHeader = calendarSection.createDiv({ cls: "calendar-header" });
        
        // Get month and year from currentDisplayMonth
        const today = new Date();
        const displayMonth = this.currentDisplayMonth.toLocaleString('default', { month: 'long' });
        const displayYear = this.currentDisplayMonth.getFullYear();
        
        calendarHeader.createDiv({ 
            cls: "calendar-title",
            text: `${displayMonth} ${displayYear}`
        });
        
        // Create navigation buttons
        const navigationDiv = calendarHeader.createDiv({ cls: "calendar-nav" });
        const prevButton = navigationDiv.createEl("button", { text: "◀" });
        const todayButton = navigationDiv.createEl("button", { text: "Today" });
        const nextButton = navigationDiv.createEl("button", { text: "▶" });
        
        // Add event listeners for navigation buttons
        prevButton.addEventListener("click", () => {
            const newDate = new Date(this.currentDisplayMonth);
            newDate.setMonth(newDate.getMonth() - 1);
            this.currentDisplayMonth = newDate;
            this.onOpen();
        });
        
        todayButton.addEventListener("click", () => {
            // Update both the display month and selected date to today
            const today = new Date();
            this.currentDisplayMonth = today;
            this.selectedDate = today;
            this.onOpen();
        });
        
        nextButton.addEventListener("click", () => {
            const newDate = new Date(this.currentDisplayMonth);
            newDate.setMonth(newDate.getMonth() + 1);
            this.currentDisplayMonth = newDate;
            this.onOpen();
        });
        
        // Create the calendar grid
        const calendarGrid = calendarSection.createDiv({ cls: "calendar-grid" });
        
        // Add day headers (Sun, Mon, etc)
        const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        daysOfWeek.forEach(day => {
            calendarGrid.createDiv({ 
                cls: "calendar-day-header",
                text: day
            });
        });
        
        // Get first and last day of the displayed month
        const firstDayOfMonth = new Date(this.currentDisplayMonth.getFullYear(), this.currentDisplayMonth.getMonth(), 1);
        const lastDayOfMonth = new Date(this.currentDisplayMonth.getFullYear(), this.currentDisplayMonth.getMonth() + 1, 0);
        
        // Get days from previous month (if needed)
        const daysFromPrevMonth = firstDayOfMonth.getDay();
        const prevMonthLastDay = new Date(this.currentDisplayMonth.getFullYear(), this.currentDisplayMonth.getMonth(), 0).getDate();
        
        // Add empty cells for days from previous month 
        for (let i = 0; i < daysFromPrevMonth; i++) {
            const dayNum = prevMonthLastDay - daysFromPrevMonth + i + 1;
            const prevMonthDay = calendarGrid.createDiv({ 
                cls: "calendar-day prev-month",
                text: dayNum.toString()
            });
            
            // Create date object for previous month's day
            const prevMonthDate = new Date(this.currentDisplayMonth.getFullYear(), this.currentDisplayMonth.getMonth() - 1, dayNum);
            this.addDayClasses(prevMonthDay, prevMonthDate, today, cycleData);
        }

        // Create current month days
        for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
            const day = calendarGrid.createDiv({ 
                cls: "calendar-day",
                text: i.toString()
            });
            
            // Create date object for current day
            const currentDate = new Date(this.currentDisplayMonth.getFullYear(), this.currentDisplayMonth.getMonth(), i);
            this.addDayClasses(day, currentDate, today, cycleData);
        }
        
        // Add days from next month to fill out the grid
        const totalDaysShown = daysFromPrevMonth + lastDayOfMonth.getDate();
        const daysFromNextMonth = 7 - (totalDaysShown % 7);
        if (daysFromNextMonth < 7) {
            for (let i = 1; i <= daysFromNextMonth; i++) {
                const nextMonthDay = calendarGrid.createDiv({ 
                    cls: "calendar-day next-month",
                    text: i.toString()
                });
                
                // Create date object for next month's day
                const nextMonthDate = new Date(this.currentDisplayMonth.getFullYear(), this.currentDisplayMonth.getMonth() + 1, i);
                this.addDayClasses(nextMonthDay, nextMonthDate, today, cycleData);
            }
        }
        
        // Add calendar legend
        const legendSection = calendarSection.createDiv({ cls: "calendar-legend" });
        
        // Create legend items - showing both actual and predicted
        this.createLegendItem(legendSection, "period", "Period");
        this.createLegendItem(legendSection, "period", "Period", true);
        // this.createLegendItem(legendSection, "fertile", "Fertile Window");
        this.createLegendItem(legendSection, "fertile", "Fertile Window", true);
        this.createLegendItem(legendSection, "ovulation", "Ovulation", true);
        this.createLegendItem(legendSection, "today", "Today");
    }
    
    /**
     * Add appropriate classes to a calendar day based on cycle data
     */
    private addDayClasses(dayElement: HTMLElement, date: Date, today: Date, cycleData: any) {
        // Mark today
        if (date.getDate() === today.getDate() && 
            date.getMonth() === today.getMonth() && 
            date.getFullYear() === today.getFullYear()) {
            dayElement.addClass("today");
        }
        
        // Mark selected day
        if (this.selectedDate && 
            date.getDate() === this.selectedDate.getDate() && 
            date.getMonth() === this.selectedDate.getMonth() && 
            date.getFullYear() === this.selectedDate.getFullYear()) {
            dayElement.addClass("selected");
        }
        
        // Make days clickable
        dayElement.addClass("clickable");
        dayElement.addEventListener("click", () => {
            this.selectedDate = new Date(date.getTime());
            this.onOpen(); // Refresh the view
        });
        
        // Check for cycle-related markers if we have cycle data
        if (cycleData.lastPeriodStart) {
            // Get cycle predictions for this day
            const predictions = this.calculateCyclePredictions(cycleData, date);
            
            // Check for symptoms data for this specific date
            const dateSymptoms = cycleData.symptoms.find((s: any) => 
                s.date.getDate() === date.getDate() &&
                s.date.getMonth() === date.getMonth() &&
                s.date.getFullYear() === date.getFullYear()
            );
            
            // Mark period days
            if (dateSymptoms?.periodFlow && 
                dateSymptoms.periodFlow.toLowerCase() !== "none") {
                dayElement.addClass("period");
                
                // Add intensity class if available
                if (dateSymptoms.periodFlow.toLowerCase() === "light") {
                    dayElement.addClass("period-light");
                } else if (dateSymptoms.periodFlow.toLowerCase() === "medium") {
                    dayElement.addClass("period-medium");
                } else if (dateSymptoms.periodFlow.toLowerCase() === "heavy") {
                    dayElement.addClass("period-heavy");
                } else if (dateSymptoms.periodFlow.toLowerCase() === "spotting") {
                    dayElement.addClass("period-spotting");
                }
            } else if (predictions.isPredictionValid && predictions.cycleDay >= 0 && predictions.cycleDay < cycleData.periodDuration) {
                // Check if there's an actual period recorded within 16 days of this predicted period
                const isCloseToActualPeriod = this.isWithinDaysOfActualPeriod(date, cycleData.symptoms, 16);
                
                // Only show predicted period if it's not close to an actual period
                if (!isCloseToActualPeriod) {
                    // For dates without specific data, use cycle position - this is PREDICTED data
                    dayElement.addClass("period");
                    dayElement.addClass("predicted"); // Add the predicted class for styling
                }
            }
            
            // Mark fertile window - always predicted
            if (predictions.isPredictionValid && predictions.isFertileWindow) {
                // Predicted fertility data
                dayElement.addClass("fertile");
                dayElement.addClass("predicted"); // Add the predicted class for styling
            }
            
            // Mark ovulation day - always predicted
            if (predictions.isPredictionValid && predictions.isOvulation) {
                dayElement.addClass("ovulation");
                dayElement.addClass("predicted"); // Add the predicted class for styling
            }
            
            // Add tooltip with cycle day information
            if (predictions.isPredictionValid) {
                dayElement.setAttribute("aria-label", `Cycle Day ${predictions.cycleDay + 1}`);
                dayElement.addClass("has-tooltip");
            }
            
            // If this date has recorded symptoms, add visual indicator
            if (dateSymptoms) {
                const dotIndicator = dayElement.createDiv({ cls: "symptom-indicator" });
            }
        }
    }
    
    /**
     * Check if a date is within the specified number of days of an actual recorded period
     */
    private isWithinDaysOfActualPeriod(date: Date, symptoms: any[], withinDays: number): boolean {
        if (!symptoms || symptoms.length === 0) {
            return false;
        }
        
        // Find any dates with actual period flow recorded
        const periodsRecorded = symptoms.filter(s => 
            s.periodFlow && s.periodFlow.toLowerCase() !== "none"
        );
        
        // Check if any of those dates are within the specified number of days
        return periodsRecorded.some(periodData => {
            const periodDate = periodData.date;
            const daysDifference = Math.abs(
                Math.floor((date.getTime() - periodDate.getTime()) / (1000 * 60 * 60 * 24))
            );
            return daysDifference <= withinDays;
        });
    }
    
    /**
     * Create a legend item in the calendar
     */
    private createLegendItem(container: HTMLElement, cssClass: string, label: string, predicted: boolean = false) {
        const legendItem = container.createDiv({ cls: "legend-item" });
        let legendColorClass = `legend-color ${cssClass}`;
        if (predicted) {
            legendColorClass += " predicted";
        }
        legendItem.createDiv({ cls: legendColorClass });
        legendItem.createDiv({ cls: "legend-label", text: predicted ? `Predicted ${label}` : label });
    }

    renderSymptomSections(container: HTMLElement, cycleData: any, selectedDate: Date) {
        // Check if we have any symptoms data
        if (!cycleData.symptoms || cycleData.symptoms.length === 0) {
            return;
        }
        
        // Find symptoms for the selected date
        const selectedDateSymptoms = cycleData.symptoms.find((s: DailySymptoms) => 
            s.date.getDate() === selectedDate.getDate() &&
            s.date.getMonth() === selectedDate.getMonth() &&
            s.date.getFullYear() === selectedDate.getFullYear()
        );
        
        if (selectedDateSymptoms) {
            // Show symptoms for the selected date
            container.createEl("h3", { text: "Symptoms & Data" });
            
            // Physical symptoms
            const physicalSymptoms = [];
            if (selectedDateSymptoms.periodFlow !== null) {
                physicalSymptoms.push({ name: "Period Flow", value: selectedDateSymptoms.periodFlow || "None" });
            }
            if (selectedDateSymptoms.discharge !== null) {
                physicalSymptoms.push({ name: "Discharge", value: selectedDateSymptoms.discharge || "None" });
            }
            if (selectedDateSymptoms.cramps !== null) {
                physicalSymptoms.push({ name: "Cramps", value: selectedDateSymptoms.cramps ? "Yes" : "No" });
            }
            if (selectedDateSymptoms.bloating !== null) {
                physicalSymptoms.push({ name: "Bloating", value: selectedDateSymptoms.bloating ? "Yes" : "No" });
            }
            if (selectedDateSymptoms.breastTenderness !== null) {
                physicalSymptoms.push({ name: "Breast Tenderness", value: selectedDateSymptoms.breastTenderness ? "Yes" : "No" });
            }
            if (selectedDateSymptoms.headaches !== null) {
                physicalSymptoms.push({ name: "Headaches", value: selectedDateSymptoms.headaches ? "Yes" : "No" });
            }
            if (selectedDateSymptoms.bowelChanges !== null) {
                physicalSymptoms.push({ name: "Bowel Changes", value: selectedDateSymptoms.bowelChanges || "None" });
            }
            
            // Emotional symptoms
            const emotionalSymptoms = [];
            if (selectedDateSymptoms.mood !== null) {
                emotionalSymptoms.push({ name: "Mood", value: selectedDateSymptoms.mood || "Normal" });
            }
            if (selectedDateSymptoms.energyLevels !== null) {
                emotionalSymptoms.push({ name: "Energy", value: selectedDateSymptoms.energyLevels || "Normal" });
            }
            if (selectedDateSymptoms.anxiety !== null) {
                emotionalSymptoms.push({ name: "Anxiety", value: selectedDateSymptoms.anxiety || "Low" });
            }
            if (selectedDateSymptoms.concentration !== null) {
                emotionalSymptoms.push({ name: "Concentration", value: selectedDateSymptoms.concentration || "Normal" });
            }
            if (selectedDateSymptoms.sexDrive !== null) {
                emotionalSymptoms.push({ name: "Sex Drive", value: selectedDateSymptoms.sexDrive || "Normal" });
            }
            
            // Lifestyle factors
            const lifestyleFactors = [];
            if (selectedDateSymptoms.physicalActivity !== null) {
                lifestyleFactors.push({ name: "Exercise", value: selectedDateSymptoms.physicalActivity || "None" });
            }
            if (selectedDateSymptoms.nutrition !== null) {
                lifestyleFactors.push({ name: "Nutrition", value: selectedDateSymptoms.nutrition || "Normal" });
            }
            if (selectedDateSymptoms.waterIntake !== null) {
                lifestyleFactors.push({ name: "Water Intake", value: selectedDateSymptoms.waterIntake || "Normal" });
            }
            if (selectedDateSymptoms.alcoholConsumption !== null) {
                lifestyleFactors.push({ name: "Alcohol", value: selectedDateSymptoms.alcoholConsumption || "None" });
            }
            if (selectedDateSymptoms.medication !== null) {
                lifestyleFactors.push({ name: "Medication", value: selectedDateSymptoms.medication || "None" });
            }
            if (selectedDateSymptoms.sexualActivity !== null) {
                lifestyleFactors.push({ name: "Sexual Activity", value: selectedDateSymptoms.sexualActivity || "None" });
            }
            
            // Render categories if they have data
            if (physicalSymptoms.length > 0) {
                this.renderSymptomCategory(container, "Physical Symptoms", physicalSymptoms);
            }
            
            if (emotionalSymptoms.length > 0) {
                this.renderSymptomCategory(container, "Emotional & Mental State", emotionalSymptoms);
            }
            
            if (lifestyleFactors.length > 0) {
                this.renderSymptomCategory(container, "Lifestyle Factors", lifestyleFactors);
            }
        } else {
            // Show message when no data exists for selected date
            const noDataMsg = container.createDiv({ cls: "no-data-message" });
            noDataMsg.createEl("h3", { text: "No Data Available" });
            noDataMsg.createEl("p", { 
                text: `No symptoms or data recorded for ${selectedDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}.` 
            });
        }
    }

    renderSymptomCategory(container: HTMLElement, title: string, symptoms: { name: string, value: string }[]) {
        const categorySection = container.createDiv({ cls: "symptom-category" });
        
        categorySection.createDiv({
            cls: "symptom-title",
            text: title
        });
        
        const symptomsGrid = categorySection.createDiv({ cls: "symptom-grid" });
        
        symptoms.forEach(symptom => {
            const card = symptomsGrid.createDiv({ cls: "symptom-card" });
            
            card.createDiv({
                cls: "symptom-name",
                text: symptom.name
            });
            
            card.createDiv({
                cls: "symptom-value",
                text: symptom.value
            });
            
            // Add intensity class based on value - ensuring value is a string before calling toLowerCase()
            if (typeof symptom.value === 'string') {
                const lowerValue = symptom.value.toLowerCase();
                if (lowerValue === "low" || lowerValue === "light") {
                    card.addClass("intensity-low");
                } else if (lowerValue === "medium") {
                    card.addClass("intensity-medium");
                } else if (lowerValue === "high" || lowerValue === "heavy") {
                    card.addClass("intensity-high");
                }
            }
        });
    }
}
