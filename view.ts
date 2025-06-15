import { ItemView, WorkspaceLeaf, Modal, Notice, TFile } from 'obsidian';
import type CycleTracker from './main';
import { DataProcessor, CycleData, CycleInfo, DailySymptoms } from './data';

export const VIEW_TYPE_CYCLE_TRACKER = "cycle-tracker-view";

/**
 * Simplified modal for displaying raw cycle data
 */
class RawDataModal extends Modal {
    data: CycleData;
    
    constructor(app: any, data: CycleData) {
        super(app);
        this.data = data;
    }
    
    onOpen() {
        const {contentEl} = this;
        contentEl.empty();
        
        contentEl.createEl('h2', {text: 'Raw Cycle Data'});
        contentEl.createEl('p', {
            text: 'This is the raw data used by the Cycle Tracker plugin. You can copy this for backup or debugging purposes.'
        });
        
        const dataContainer = contentEl.createDiv({ cls: 'raw-data-container' });
        
        // Format and display data
        const formattedData = JSON.stringify({
            symptomCount: this.data.symptoms.size,
            cycleCount: this.data.cycles.length,
            dateRange: {
                earliest: this.data.dateRange.earliest.toISOString(),
                latest: this.data.dateRange.latest.toISOString()
            },
            cycles: this.data.cycles.map(c => ({
                id: c.id,
                startDate: c.startDate.toISOString(),
                endDate: c.endDate.toISOString(),
                periodDays: c.periodDays,
                cycleLength: c.cycleLength
            })),
            recentSymptoms: Array.from(this.data.symptoms.values())
                .slice(-10)
                .map(s => ({
                    date: s.date.toISOString(),
                    periodFlow: s.periodFlow,
                    // Include other non-null symptoms
                    ...Object.fromEntries(
                        Object.entries(s).filter(([key, value]) => 
                            key !== 'date' && value !== null
                        )
                    )
                }))
        }, null, 2);
        
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
                setTimeout(() => copyButton.setText('Copy to Clipboard'), 2000);
            });
        });
    }
    
    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

export class CycleTrackerView extends ItemView {
    plugin: CycleTracker;
    dataProcessor: DataProcessor;
    currentDisplayMonth: Date;
    selectedDate: Date | null;
    cycleData: CycleData | null = null;
    contextMenu: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: CycleTracker) {
        super(leaf);
        this.plugin = plugin;
        this.dataProcessor = new DataProcessor(this.app, plugin);
        this.currentDisplayMonth = new Date();
        this.selectedDate = null;
        this.contextMenu = null;
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
        
        await this.renderMainView(container);
    }

    async renderMainView(container: HTMLElement) {
        // Load cycle data
        try {
            this.cycleData = await this.dataProcessor.loadCycleData(this.plugin.settings);
        } catch (error) {
            console.error('Failed to load cycle data:', error);
            container.createDiv({
                cls: "error-message",
                text: "Failed to load cycle data. Check console for details."
            });
            return;
        }
        
        // Create header
        const headerContainer = container.createDiv({ cls: "header-container" });
        headerContainer.createEl("h2", { text: "Cycle Tracker" });
        
        // Add view raw data button
        const viewDataButton = headerContainer.createEl("button", {
            cls: "view-data-button",
            text: "View Raw Data"
        });
        
        viewDataButton.addEventListener("click", () => {
            if (this.cycleData) {
                const modal = new RawDataModal(this.app, this.cycleData);
                modal.open();
            }
        });
        
        if (!this.cycleData || this.cycleData.symptoms.size === 0) {
            container.createDiv({
                cls: "no-data-message",
                text: "No cycle data available. Add period data to your daily notes to get started."
            });
            return;
        }

        // Default to today if no date selected
        if (!this.selectedDate) {
            this.selectedDate = new Date();
        }

        // Render sections
        this.renderCycleOverview(container, this.selectedDate);
        this.renderCalendar(container);
        this.renderSymptomDetails(container, this.selectedDate);
    }

    renderCycleOverview(container: HTMLElement, selectedDate: Date) {
        const overviewSection = container.createDiv({ cls: "cycle-overview" });
        
        // Display selected date
        overviewSection.createDiv({
            cls: "selected-date",
            text: selectedDate.toLocaleDateString('default', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            })
        });

        if (!this.cycleData) return;

        // Check if selected date is before the first recorded period
        const firstPeriodDate = this.dataProcessor.getFirstRecordedPeriodDate(this.cycleData);
        if (firstPeriodDate && selectedDate < firstPeriodDate) {
            // Display "No data" for dates before first recorded period
            overviewSection.createDiv({
                cls: "cycle-day-counter",
                text: "No data"
            });
            return;
        }

        // Get cycle info for selected date
        const cycleInfo = this.dataProcessor.getCycleInfo(this.cycleData, selectedDate);
        
        if (cycleInfo) {
            // Show cycle day
            overviewSection.createDiv({
                cls: "cycle-day-counter",
                text: `Day ${cycleInfo.cycleDay} of cycle`
            });
            
            // Show phase
            overviewSection.createDiv({
                cls: "cycle-phase",
                text: this.formatPhase(cycleInfo.phase)
            });
            
            // Determine cycle type and show appropriate additional information
            const cycleType = this.dataProcessor.getCycleType(this.cycleData, selectedDate);
            
            if (cycleType === 'current') {
                // Calculate days from selected date to predicted period end for current cycle
                const predictedPeriodEnd = this.dataProcessor.getPredictedPeriodEndForCycle(this.cycleData, cycleInfo.cycle);
                if (predictedPeriodEnd && predictedPeriodEnd > selectedDate) {
                    const daysToNext = Math.ceil((predictedPeriodEnd.getTime() - selectedDate.getTime()) / (1000 * 60 * 60 * 24));
                    overviewSection.createDiv({
                        cls: "cycle-info",
                        text: `Next period expected in ${daysToNext} days`
                    });
                }
            } else if (cycleType === 'past') {
                // Show cycle length for past cycles
                if (cycleInfo.cycle.cycleLength) {
                    overviewSection.createDiv({
                        cls: "cycle-info",
                        text: `Cycle length: ${cycleInfo.cycle.cycleLength} days`
                    });
                }
            }
            // For 'future' or 'none' cycle types, don't show additional info but maintain height
            
        } else {
            overviewSection.createDiv({
                cls: "no-cycle-info",
                text: "No cycle information available for this date"
            });
        }
    }

    renderCalendar(container: HTMLElement) {
        const calendarSection = container.createDiv({ cls: "cycle-calendar" });
        
        // Calendar header with navigation
        const calendarHeader = calendarSection.createDiv({ cls: "calendar-header" });
        
        const displayMonth = this.currentDisplayMonth.toLocaleString('default', { month: 'long' });
        const displayYear = this.currentDisplayMonth.getFullYear();
        
        calendarHeader.createDiv({ 
            cls: "calendar-title",
            text: `${displayMonth} ${displayYear}`
        });
        
        // Navigation buttons
        const navigationDiv = calendarHeader.createDiv({ cls: "calendar-nav" });
        const prevButton = navigationDiv.createEl("button", { text: "◀" });
        const todayButton = navigationDiv.createEl("button", { text: "Today" });
        const nextButton = navigationDiv.createEl("button", { text: "▶" });
        
        prevButton.addEventListener("click", () => {
            this.currentDisplayMonth.setMonth(this.currentDisplayMonth.getMonth() - 1);
            this.onOpen();
        });
        
        todayButton.addEventListener("click", () => {
            this.currentDisplayMonth = new Date();
            this.selectedDate = new Date();
            this.onOpen();
        });
        
        nextButton.addEventListener("click", () => {
            this.currentDisplayMonth.setMonth(this.currentDisplayMonth.getMonth() + 1);
            this.onOpen();
        });
        
        // Calendar grid
        const calendarGrid = calendarSection.createDiv({ cls: "calendar-grid" });
        
        // Day headers
        const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        daysOfWeek.forEach(day => {
            calendarGrid.createDiv({ 
                cls: "calendar-day-header",
                text: day
            });
        });
        
        // Calendar days
        this.renderCalendarDays(calendarGrid);
        
        // Legend
        this.renderCalendarLegend(calendarSection);
    }

    renderCalendarDays(calendarGrid: HTMLElement) {
        const firstDayOfMonth = new Date(this.currentDisplayMonth.getFullYear(), this.currentDisplayMonth.getMonth(), 1);
        const lastDayOfMonth = new Date(this.currentDisplayMonth.getFullYear(), this.currentDisplayMonth.getMonth() + 1, 0);
        const today = new Date();
        
        // Add days from previous month
        const daysFromPrevMonth = firstDayOfMonth.getDay();
        for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
            const date = new Date(firstDayOfMonth);
            date.setDate(date.getDate() - i - 1);
            this.renderCalendarDay(calendarGrid, date, today, true);
        }
        
        // Add current month days
        for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
            const date = new Date(this.currentDisplayMonth.getFullYear(), this.currentDisplayMonth.getMonth(), day);
            this.renderCalendarDay(calendarGrid, date, today, false);
        }
        
        // Add days from next month
        const totalDaysShown = daysFromPrevMonth + lastDayOfMonth.getDate();
        const daysFromNextMonth = 7 - (totalDaysShown % 7);
        if (daysFromNextMonth < 7) {
            for (let day = 1; day <= daysFromNextMonth; day++) {
                const date = new Date(this.currentDisplayMonth.getFullYear(), this.currentDisplayMonth.getMonth() + 1, day);
                this.renderCalendarDay(calendarGrid, date, today, true);
            }
        }
    }

    renderCalendarDay(calendarGrid: HTMLElement, date: Date, today: Date, isOtherMonth: boolean) {
        const dayElement = calendarGrid.createDiv({ 
            cls: `calendar-day ${isOtherMonth ? 'other-month' : ''}`,
            text: date.getDate().toString()
        });
        
        // Mark today
        if (this.isSameDate(date, today)) {
            dayElement.addClass("today");
        }
        
        // Mark selected day
        if (this.selectedDate && this.isSameDate(date, this.selectedDate)) {
            dayElement.addClass("selected");
        }
        
        // Add click handler
        dayElement.addClass("clickable");
        dayElement.addEventListener("click", () => {
            this.selectedDate = new Date(date.getTime());
            this.onOpen();
        });
        
        // Add context menu handler
        dayElement.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            this.showContextMenu(event, date);
        });
        
        // Add cycle-related styling
        if (this.cycleData) {
            this.addCycleClasses(dayElement, date);
        }
    }

    addCycleClasses(dayElement: HTMLElement, date: Date) {
        if (!this.cycleData) return;
        
        const cycleInfo = this.dataProcessor.getCycleInfo(this.cycleData, date);
        if (!cycleInfo) return;
        
        // Add period classes
        if (cycleInfo.isActualPeriodDay) {
            dayElement.addClass("period");
            dayElement.addClass("actual");
        } else if (cycleInfo.isPredictedPeriodDay) {
            dayElement.addClass("period");
            dayElement.addClass("predicted");
        }
        
        // Add fertile window
        if (cycleInfo.isFertileWindow) {
            dayElement.addClass("fertile");
            dayElement.addClass("predicted");
        }
        
        // Add ovulation
        if (cycleInfo.isOvulationDay) {
            dayElement.addClass("ovulation");
            dayElement.addClass("predicted");
        }
        
        // Add tooltip
        dayElement.setAttribute("aria-label", `Cycle Day ${cycleInfo.cycleDay} - ${this.formatPhase(cycleInfo.phase)}`);
        dayElement.addClass("has-tooltip");
        
        // Add symptom indicator if symptoms exist
        const dateKey = this.formatDateKey(date);
        const symptoms = this.cycleData.symptoms.get(dateKey);
        if (symptoms && this.hasSymptoms(symptoms)) {
            dayElement.createDiv({ cls: "symptom-indicator" });
        }
    }

    renderCalendarLegend(calendarSection: HTMLElement) {
        const legendSection = calendarSection.createDiv({ cls: "calendar-legend" });
        
        this.createLegendItem(legendSection, "period actual", "Period (Recorded)");
        this.createLegendItem(legendSection, "period predicted", "Period (Predicted)");
        this.createLegendItem(legendSection, "fertile predicted", "Fertile Window");
        this.createLegendItem(legendSection, "ovulation predicted", "Ovulation");
        this.createLegendItem(legendSection, "today", "Today");
    }

    createLegendItem(container: HTMLElement, cssClass: string, label: string) {
        const legendItem = container.createDiv({ cls: "legend-item" });
        legendItem.createDiv({ cls: `legend-color ${cssClass}` });
        legendItem.createDiv({ cls: "legend-label", text: label });
    }

    renderSymptomDetails(container: HTMLElement, selectedDate: Date) {
        if (!this.cycleData) return;
        
        const dateKey = this.formatDateKey(selectedDate);
        const symptoms = this.cycleData.symptoms.get(dateKey);
        const cycleInfo = this.dataProcessor.getCycleInfo(this.cycleData, selectedDate);
        
        if (!symptoms && !cycleInfo) {
            container.createDiv({
                cls: "no-data-message",
                text: `No data available for ${selectedDate.toLocaleDateString()}.`
            });
            return;
        }
        
        container.createEl("h3", { text: "Day Details" });
        
        // Cycle information section
        if (cycleInfo) {
            const cycleSection = container.createDiv({ cls: "symptom-category" });
            cycleSection.createDiv({ cls: "symptom-title", text: "Cycle Information" });
            
            const cycleGrid = cycleSection.createDiv({ cls: "symptom-grid" });
            
            // Create cycle info cards using the symptom-grid layout
            this.createSymptomCard(cycleGrid, "Cycle Day", cycleInfo.cycleDay.toString());
            this.createSymptomCard(cycleGrid, "Phase", this.formatPhase(cycleInfo.phase));
            this.createSymptomCard(cycleGrid, "Period Start", cycleInfo.cycle.startDate.toLocaleDateString());
            if (cycleInfo.cycle.cycleLength) {
                this.createSymptomCard(cycleGrid, "Cycle Length", `${cycleInfo.cycle.cycleLength} days`);
            }
        }
        
        // Symptoms sections using symptom-grid layout
        if (symptoms) {
            const symptomData = this.formatSymptomsForDisplay(symptoms);
            
            if (symptomData.physical.length > 0) {
                this.renderSymptomSection(container, "Physical Symptoms", symptomData.physical);
            }
            
            if (symptomData.emotional.length > 0) {
                this.renderSymptomSection(container, "Emotional State", symptomData.emotional);
            }
            
            if (symptomData.lifestyle.length > 0) {
                this.renderSymptomSection(container, "Lifestyle Factors", symptomData.lifestyle);
            }
        }
    }

    renderSymptomSection(container: HTMLElement, title: string, items: Array<{name: string, value: string}>) {
        const section = container.createDiv({ cls: "symptom-category" });
        section.createDiv({ cls: "symptom-title", text: title });
        
        const grid = section.createDiv({ cls: "symptom-grid" });
        items.forEach(item => {
            this.createSymptomCard(grid, item.name, item.value);
        });
    }

    createSymptomCard(container: HTMLElement, name: string, value: string) {
        const card = container.createDiv({ cls: "symptom-card" });
        
        // Add intensity class based on value for visual indicators
        const intensityClass = this.getIntensityClass(value);
        if (intensityClass) {
            card.addClass(intensityClass);
        }
        
        card.createDiv({ cls: "symptom-name", text: name });
        card.createDiv({ cls: "symptom-value", text: value });
    }

    getIntensityClass(value: string): string | null {
        const lowerValue = value.toLowerCase();
        
        // Map common values to intensity classes
        if (['none', 'no', 'normal'].includes(lowerValue)) {
            return 'intensity-none';
        }
        if (['light', 'low', 'mild'].includes(lowerValue)) {
            return 'intensity-low';
        }
        if (['medium', 'moderate'].includes(lowerValue)) {
            return 'intensity-medium';
        }
        if (['heavy', 'high', 'severe', 'yes'].includes(lowerValue)) {
            return 'intensity-high';
        }
        
        return null;
    }

    // === UTILITY METHODS ===

    private formatPhase(phase: 'menstrual' | 'follicular' | 'ovulation' | 'luteal'): string {
        const phases = {
            menstrual: 'Menstrual Phase',
            follicular: 'Follicular Phase',
            ovulation: 'Ovulation Phase',
            luteal: 'Luteal Phase'
        };
        return phases[phase];
    }

    private isSameDate(date1: Date, date2: Date): boolean {
        return date1.getDate() === date2.getDate() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getFullYear() === date2.getFullYear();
    }

    private formatDateKey(date: Date): string {
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    }

    private hasSymptoms(symptoms: DailySymptoms): boolean {
        return Object.entries(symptoms).some(([key, value]) => 
            key !== 'date' && value !== null
        );
    }

    private formatSymptomsForDisplay(symptoms: DailySymptoms) {
        const physical = [];
        const emotional = [];
        const lifestyle = [];
        
        if (symptoms.periodFlow !== null) {
            physical.push({ name: "Period Flow", value: symptoms.periodFlow || "None" });
        }
        if (symptoms.discharge !== null) {
            physical.push({ name: "Discharge", value: symptoms.discharge || "None" });
        }
        if (symptoms.cramps !== null) {
            physical.push({ name: "Cramps", value: symptoms.cramps ? "Yes" : "No" });
        }
        if (symptoms.bloating !== null) {
            physical.push({ name: "Bloating", value: symptoms.bloating ? "Yes" : "No" });
        }
        if (symptoms.breastTenderness !== null) {
            physical.push({ name: "Breast Tenderness", value: symptoms.breastTenderness ? "Yes" : "No" });
        }
        if (symptoms.headaches !== null) {
            physical.push({ name: "Headaches", value: symptoms.headaches ? "Yes" : "No" });
        }
        if (symptoms.bowelChanges !== null) {
            physical.push({ name: "Bowel Changes", value: symptoms.bowelChanges || "None" });
        }
        
        if (symptoms.mood !== null) {
            emotional.push({ name: "Mood", value: symptoms.mood || "Normal" });
        }
        if (symptoms.energyLevels !== null) {
            emotional.push({ name: "Energy", value: symptoms.energyLevels || "Normal" });
        }
        if (symptoms.anxiety !== null) {
            emotional.push({ name: "Anxiety", value: symptoms.anxiety || "Low" });
        }
        if (symptoms.concentration !== null) {
            emotional.push({ name: "Concentration", value: symptoms.concentration || "Normal" });
        }
        if (symptoms.sexDrive !== null) {
            emotional.push({ name: "Sex Drive", value: symptoms.sexDrive || "Normal" });
        }
        
        if (symptoms.physicalActivity !== null) {
            lifestyle.push({ name: "Exercise", value: symptoms.physicalActivity || "None" });
        }
        if (symptoms.nutrition !== null) {
            lifestyle.push({ name: "Nutrition", value: symptoms.nutrition || "Normal" });
        }
        if (symptoms.waterIntake !== null) {
            lifestyle.push({ name: "Water Intake", value: symptoms.waterIntake || "Normal" });
        }
        if (symptoms.alcoholConsumption !== null) {
            lifestyle.push({ name: "Alcohol", value: symptoms.alcoholConsumption || "None" });
        }
        if (symptoms.medication !== null) {
            lifestyle.push({ name: "Medication", value: symptoms.medication || "None" });
        }
        if (symptoms.sexualActivity !== null) {
            lifestyle.push({ name: "Sexual Activity", value: symptoms.sexualActivity || "None" });
        }
        
        return { physical, emotional, lifestyle };
    }

    // === CONTEXT MENU METHODS ===

    /**
     * Show context menu for calendar day
     */
    private showContextMenu(event: MouseEvent, date: Date) {
        // Hide any existing context menu
        this.hideContextMenu();
        
        // Create context menu
        this.contextMenu = document.createElement('div');
        this.contextMenu.className = 'cycle-tracker-context-menu';
        
        // Create menu item for opening daily note
        const openNoteItem = this.contextMenu.createDiv({ cls: 'context-menu-item' });
        openNoteItem.textContent = 'Open Daily Note';
        openNoteItem.addEventListener('click', () => {
            this.openDailyNote(date);
            this.hideContextMenu();
        });
        
        // Position the context menu
        this.contextMenu.style.position = 'fixed';
        this.contextMenu.style.left = `${event.clientX}px`;
        this.contextMenu.style.top = `${event.clientY}px`;
        this.contextMenu.style.zIndex = '1000';
        
        // Add to document
        document.body.appendChild(this.contextMenu);
        
        // Add click outside handler to close menu
        const hideHandler = (e: MouseEvent) => {
            if (!this.contextMenu?.contains(e.target as Node)) {
                this.hideContextMenu();
                document.removeEventListener('click', hideHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', hideHandler), 0);
    }

    /**
     * Hide context menu
     */
    private hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
        }
    }

    /**
     * Open daily note for the specified date
     */
    private async openDailyNote(date: Date) {
        try {
            // Format date for daily note filename (YYYY-MM-DD)
            const dateStr = this.formatDateKey(date);
            const fileName = `${dateStr}.md`;
            const dailyNotesFolder = this.plugin.settings.dailyNotesFolder || 'Daily Notes';
            const filePath = `${dailyNotesFolder}/${fileName}`;
            
            // Check if file exists
            let file = this.app.vault.getAbstractFileByPath(filePath);
            
            if (!file) {
                // Create the file if it doesn't exist
                const folderPath = dailyNotesFolder;
                
                // Ensure the folder exists
                if (!this.app.vault.getAbstractFileByPath(folderPath)) {
                    await this.app.vault.createFolder(folderPath);
                }
                
                // Create basic daily note content with date
                const content = `# ${date.toLocaleDateString('default', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })}\n\n`;
                
                file = await this.app.vault.create(filePath, content);
            }
            
            // Open the file if it's a TFile
            if (file instanceof TFile) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(file);
            }
            
        } catch (error) {
            console.error('Error opening daily note:', error);
            new Notice(`Failed to open daily note for ${date.toLocaleDateString()}`);
        }
    }
}
