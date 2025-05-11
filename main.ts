import { App, Editor, MarkdownView, Modal, Notice, Plugin, WorkspaceLeaf, addIcon } from 'obsidian';
import { CycleTrackerView, VIEW_TYPE_CYCLE_TRACKER } from './view';
import { CycleTrackerSettingTab, DEFAULT_SETTINGS, type CycleTrackerSettings } from './settings';
import { DataHandler, type CycleData } from './data';

// Add custom icon for the cycle tracker
addIcon('cycle-tracker', `<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="6"/>
  <path d="M50 5 L50 15 M50 85 L50 95 M5 50 L15 50 M85 50 L95 50" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
  <circle cx="50" cy="50" r="6" fill="currentColor"/>
</svg>`);

// Main plugin class
export default class CycleTracker extends Plugin {
	settings: CycleTrackerSettings;
	dataHandler: DataHandler;
	statusBarItem: HTMLElement;

	async onload() {
		await this.loadSettings();
		
		// Initialize data handler
		this.dataHandler = new DataHandler(this.app, this);

		// Register the custom view
		this.registerView(
			VIEW_TYPE_CYCLE_TRACKER,
			(leaf) => new CycleTrackerView(leaf, this)
		);

		// Add ribbon icon in the left sidebar
		this.addRibbonIcon('cycle-tracker', 'Cycle Tracker', () => {
			this.activateView();
		});

		// Add command to open the cycle tracker
		this.addCommand({
			id: 'open-cycle-tracker',
			name: 'Open Cycle Tracker',
			callback: () => {
				this.activateView();
			}
		});
		
		// Add settings tab
		this.addSettingTab(new CycleTrackerSettingTab(this.app, this));
		
		// Add a status bar item that shows days since last period
		this.statusBarItem = this.addStatusBarItem();
		this.statusBarItem.setText('Loading cycle data...');
	this.updateStatusBar();
	}

	async updateStatusBar() {
		const statusBarItem = this.statusBarItem;
		
		try {
			const cycleData = await this.getCycleData();
			
			if (cycleData.lastPeriodStart) {
				const today = new Date();
				const daysSinceLastPeriod = Math.floor(
					(today.getTime() - cycleData.lastPeriodStart.getTime()) / (1000 * 60 * 60 * 24)
				);
				
				statusBarItem.setText(`Cycle: Day ${daysSinceLastPeriod}`);
			} else {
				statusBarItem.setText('No cycle data found');
			}
		} catch (error) {
			console.error("Error updating status bar:", error);
			statusBarItem.setText('Error loading cycle data');
		}
	}

	async activateView() {
		const { workspace } = this.app;
		
		// Check if view is already open
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_CYCLE_TRACKER)[0];
		
		if (!leaf) {
			// Create a new leaf in the main workspace area
			leaf = workspace.getLeaf('tab');
			if (leaf) {
				await leaf.setViewState({
					type: VIEW_TYPE_CYCLE_TRACKER,
					active: true,
				});
			}
		}
		
		// Reveal and focus the leaf if it exists
		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}
	
	async getCycleData(): Promise<CycleData> {
		// Use the data handler to get cycle data
		return await this.dataHandler.getCycleData(this.settings);
	}

	onunload() {
		// Clean up when the plugin is disabled
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_CYCLE_TRACKER);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Update any open views when settings change
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
