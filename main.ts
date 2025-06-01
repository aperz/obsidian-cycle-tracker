import { App, Plugin, addIcon } from 'obsidian';
import { CycleTrackerView, VIEW_TYPE_CYCLE_TRACKER } from './view';
import { CycleTrackerSettingTab, DEFAULT_SETTINGS, type CycleTrackerSettings } from './settings';
import { DataProcessor } from './data';

// Add custom icon for the cycle tracker
addIcon('cycle-tracker', `<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="6"/>
  <path d="M50 5 L50 15 M50 85 L50 95 M5 50 L15 50 M85 50 L95 50" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
  <circle cx="50" cy="50" r="6" fill="currentColor"/>
</svg>`);

// Clean main plugin class
export default class CycleTracker extends Plugin {
    settings: CycleTrackerSettings;
    dataProcessor: DataProcessor;
    statusBarItem: HTMLElement;

    async onload() {
        await this.loadSettings();
        
        // Initialize data processor
        this.dataProcessor = new DataProcessor(this.app, this);

        // Register the clean view
        this.registerView(
            VIEW_TYPE_CYCLE_TRACKER,
            (leaf) => new CycleTrackerView(leaf, this)
        );

        // Add ribbon icon
        this.addRibbonIcon('cycle-tracker', 'Cycle Tracker', () => {
            this.activateView();
        });

        // Add command
        this.addCommand({
            id: 'open-cycle-tracker',
            name: 'Open Cycle Tracker',
            callback: () => {
                this.activateView();
            }
        });
        
        // Add settings tab
        this.addSettingTab(new CycleTrackerSettingTab(this.app, this));
        
        // Add status bar item
        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.setText('Loading cycle data...');
        this.updateStatusBar();
    }

    async updateStatusBar() {
        try {
            const cycleData = await this.dataProcessor.loadCycleData(this.settings);
            
            if (cycleData.cycles.length > 0) {
                const latestCycle = cycleData.cycles[cycleData.cycles.length - 1];
                const today = new Date();
                const cycleInfo = this.dataProcessor.getCycleInfo(cycleData, today);
                
                if (cycleInfo) {
                    this.statusBarItem.setText(`Cycle: Day ${cycleInfo.cycleDay}`);
                } else {
                    this.statusBarItem.setText('No current cycle data');
                }
            } else {
                this.statusBarItem.setText('No cycle data found');
            }
        } catch (error) {
            console.error('Error updating status bar:', error);
            this.statusBarItem.setText('Error loading cycle data');
        }
    }

    async activateView() {
        const { workspace } = this.app;
        
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_CYCLE_TRACKER)[0];
        
        if (!leaf) {
            leaf = workspace.getLeaf('tab');
            if (leaf) {
                await leaf.setViewState({
                    type: VIEW_TYPE_CYCLE_TRACKER,
                    active: true
                });
            }
        }
        
        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_CYCLE_TRACKER);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.updateViews();
        this.updateStatusBar();
    }

    updateViews() {
        // Refresh all open cycle tracker views
        this.app.workspace.getLeavesOfType(VIEW_TYPE_CYCLE_TRACKER).forEach(leaf => {
            if (leaf.view instanceof CycleTrackerView) {
                leaf.view.onOpen();
            }
        });
    }
}
