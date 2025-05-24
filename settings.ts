import { App, PluginSettingTab, Setting } from 'obsidian';
import type CycleTracker from './main';

// Define the settings interface
export interface CycleTrackerSettings {
	// Daily notes location
	dailyNotesFolder: string;
	
	// Properties to track
	trackPeriodFlow: boolean;
	trackDischarge: boolean;
	trackCramps: boolean;
	trackBloating: boolean;
	trackBreastTenderness: boolean;
	trackHeadaches: boolean;
	trackBowelChanges: boolean;
	
	// Emotional states
	trackMood: boolean;
	trackEnergyLevels: boolean;
	trackAnxiety: boolean;
	trackConcentration: boolean;
	trackSexDrive: boolean;
	
	// Lifestyle factors
	trackPhysicalActivity: boolean;
	trackNutrition: boolean;
	trackWaterIntake: boolean;
	trackAlcoholConsumption: boolean;
	trackMedication: boolean;
	trackSexualActivity: boolean;
	
	// Property names in daily notes
	periodFlowProperty: string;
	dischargeProperty: string;
	crampsProperty: string;
	bloatingProperty: string;
	breastTendernessProperty: string;
	headachesProperty: string;
	bowelChangesProperty: string;
	moodProperty: string;
	energyLevelsProperty: string;
	anxietyProperty: string;
	concentrationProperty: string;
	sexDriveProperty: string;
	physicalActivityProperty: string;
	nutritionProperty: string;
	waterIntakeProperty: string;
	alcoholConsumptionProperty: string;
	medicationProperty: string;
	sexualActivityProperty: string;
}

// Define default settings
export const DEFAULT_SETTINGS: CycleTrackerSettings = {
	// Default daily notes folder
	dailyNotesFolder: "Daily Notes",
	
	// Default tracking options (all enabled by default)
	trackPeriodFlow: true,
	trackDischarge: true,
	trackCramps: true,
	trackBloating: true,
	trackBreastTenderness: true,
	trackHeadaches: true,
	trackBowelChanges: true,
	trackMood: true,
	trackEnergyLevels: true,
	trackAnxiety: true,
	trackConcentration: true,
	trackSexDrive: true,
	trackPhysicalActivity: true,
	trackNutrition: true,
	trackWaterIntake: true,
	trackAlcoholConsumption: true,
	trackMedication: true,
	trackSexualActivity: true,
	
	// Default property names in daily notes
	periodFlowProperty: "period_flow",
	dischargeProperty: "discharge",
	crampsProperty: "cramps",
	bloatingProperty: "bloating",
	breastTendernessProperty: "breast_tenderness",
	headachesProperty: "headaches",
	bowelChangesProperty: "bowel_changes",
	moodProperty: "mood",
	energyLevelsProperty: "energy",
	anxietyProperty: "anxiety",
	concentrationProperty: "concentration",
	sexDriveProperty: "sex_drive",
	physicalActivityProperty: "physical_activity",
	nutritionProperty: "nutrition",
	waterIntakeProperty: "water_intake",
	alcoholConsumptionProperty: "alcohol",
	medicationProperty: "medication",
	sexualActivityProperty: "sexual_activity"
};

export class CycleTrackerSettingTab extends PluginSettingTab {
	plugin: CycleTracker;
	// Store previous valid values for rollback on invalid input
	private previousValidValues: { [key: string]: string } = {};
	// Store error elements for each property field
	private errorElements: { [key: string]: HTMLElement } = {};

	constructor(app: App, plugin: CycleTracker) {
		super(app, plugin);
		this.plugin = plugin;
		// Initialize previous valid values with current settings
		this.initializePreviousValidValues();
	}
	
	/**
	 * Initialize previous valid values with current settings
	 */
	private initializePreviousValidValues(): void {
		this.previousValidValues = {
			periodFlowProperty: this.plugin.settings.periodFlowProperty,
			dischargeProperty: this.plugin.settings.dischargeProperty,
			crampsProperty: this.plugin.settings.crampsProperty,
			bloatingProperty: this.plugin.settings.bloatingProperty,
			breastTendernessProperty: this.plugin.settings.breastTendernessProperty,
			headachesProperty: this.plugin.settings.headachesProperty,
			bowelChangesProperty: this.plugin.settings.bowelChangesProperty,
			moodProperty: this.plugin.settings.moodProperty,
			energyLevelsProperty: this.plugin.settings.energyLevelsProperty,
			anxietyProperty: this.plugin.settings.anxietyProperty,
			concentrationProperty: this.plugin.settings.concentrationProperty,
			sexDriveProperty: this.plugin.settings.sexDriveProperty,
			physicalActivityProperty: this.plugin.settings.physicalActivityProperty,
			nutritionProperty: this.plugin.settings.nutritionProperty,
			waterIntakeProperty: this.plugin.settings.waterIntakeProperty,
			alcoholConsumptionProperty: this.plugin.settings.alcoholConsumptionProperty,
			medicationProperty: this.plugin.settings.medicationProperty,
			sexualActivityProperty: this.plugin.settings.sexualActivityProperty
		};
	}
	
	/**
	 * Validate YAML property name
	 * Valid YAML keys can contain letters, numbers, underscores, and hyphens
	 * They should not start with a number and should not contain spaces or special characters
	 */
	private validatePropertyName(propertyName: string): { valid: boolean; error?: string } {
		if (!propertyName || propertyName.trim() === '') {
			return { valid: false, error: 'Property name cannot be empty' };
		}
		
		const trimmed = propertyName.trim();
		
		// Check if property name contains only valid characters
		if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(trimmed)) {
			return { 
				valid: false, 
				error: 'Property name must start with a letter or underscore and contain only letters, numbers, underscores, and hyphens' 
			};
		}
		
		// Check reasonable length limits
		if (trimmed.length > 50) {
			return { valid: false, error: 'Property name must be 50 characters or less' };
		}
		
		return { valid: true };
	}
	
	/**
	 * Show error message for a specific property field
	 */
	private showError(propertyKey: string, errorMessage: string): void {
		if (this.errorElements[propertyKey]) {
			this.errorElements[propertyKey].textContent = errorMessage;
			this.errorElements[propertyKey].style.display = 'block';
		}
	}
	
	/**
	 * Hide error message for a specific property field
	 */
	private hideError(propertyKey: string): void {
		if (this.errorElements[propertyKey]) {
			this.errorElements[propertyKey].style.display = 'none';
		}
	}
	
	/**
	 * Create a property setting with validation
	 */
	private createPropertySetting(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		trackingSettingKey: keyof CycleTrackerSettings,
		propertySettingKey: keyof CycleTrackerSettings,
		placeholder: string
	): void {
		const setting = new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings[trackingSettingKey] as boolean)
				.onChange(async (value) => {
					(this.plugin.settings[trackingSettingKey] as boolean) = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => {
				text.setPlaceholder(placeholder)
					.setValue(this.plugin.settings[propertySettingKey] as string)
					.onChange(async (value) => {
						const validation = this.validatePropertyName(value);
						
						if (validation.valid) {
							// Valid input - save it and update previous valid value
							const trimmedValue = value.trim();
							(this.plugin.settings[propertySettingKey] as string) = trimmedValue;
							this.previousValidValues[propertySettingKey as string] = trimmedValue;
							await this.plugin.saveSettings();
							this.hideError(propertySettingKey as string);
						} else {
							// Invalid input - show error and revert to previous valid value
							this.showError(propertySettingKey as string, validation.error!);
							// Revert the input field to the previous valid value after a short delay
							setTimeout(() => {
								text.setValue(this.previousValidValues[propertySettingKey as string]);
							}, 100);
						}
					});
			});
		
		// Create error message element
		const errorEl = setting.settingEl.createEl('div', {
			cls: 'setting-item-description',
			text: '',
			attr: { style: 'color: var(--text-error); display: none; margin-top: 4px;' }
		});
		this.errorElements[propertySettingKey as string] = errorEl;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Cycle Tracker Settings' });
		
		// Daily notes folder setting
		new Setting(containerEl)
			.setName('Daily Notes Folder')
			.setDesc('Specify the folder where your daily notes are stored')
			.addText(text => text
				.setPlaceholder('Daily Notes')
				.setValue(this.plugin.settings.dailyNotesFolder)
				.onChange(async (value) => {
					this.plugin.settings.dailyNotesFolder = value;
					await this.plugin.saveSettings();
				}));
		
		
		// Add description
		containerEl.createEl('p', { 
			text: 'Configure which symptoms to track and specify the property names used in your daily notes. Property names must be valid YAML identifiers.' 
		});
		
		// Add restore defaults button
		new Setting(containerEl)
			.setName('Restore Default Property Names')
			.setDesc('Reset all property names to their default values')
			.addButton(button => button
				.setButtonText('Restore Defaults')
				.setCta()
				.onClick(async () => {
					// Restore all property names to defaults
					this.plugin.settings.periodFlowProperty = DEFAULT_SETTINGS.periodFlowProperty;
					this.plugin.settings.dischargeProperty = DEFAULT_SETTINGS.dischargeProperty;
					this.plugin.settings.crampsProperty = DEFAULT_SETTINGS.crampsProperty;
					this.plugin.settings.bloatingProperty = DEFAULT_SETTINGS.bloatingProperty;
					this.plugin.settings.breastTendernessProperty = DEFAULT_SETTINGS.breastTendernessProperty;
					this.plugin.settings.headachesProperty = DEFAULT_SETTINGS.headachesProperty;
					this.plugin.settings.bowelChangesProperty = DEFAULT_SETTINGS.bowelChangesProperty;
					this.plugin.settings.moodProperty = DEFAULT_SETTINGS.moodProperty;
					this.plugin.settings.energyLevelsProperty = DEFAULT_SETTINGS.energyLevelsProperty;
					this.plugin.settings.anxietyProperty = DEFAULT_SETTINGS.anxietyProperty;
					this.plugin.settings.concentrationProperty = DEFAULT_SETTINGS.concentrationProperty;
					this.plugin.settings.sexDriveProperty = DEFAULT_SETTINGS.sexDriveProperty;
					this.plugin.settings.physicalActivityProperty = DEFAULT_SETTINGS.physicalActivityProperty;
					this.plugin.settings.nutritionProperty = DEFAULT_SETTINGS.nutritionProperty;
					this.plugin.settings.waterIntakeProperty = DEFAULT_SETTINGS.waterIntakeProperty;
					this.plugin.settings.alcoholConsumptionProperty = DEFAULT_SETTINGS.alcoholConsumptionProperty;
					this.plugin.settings.medicationProperty = DEFAULT_SETTINGS.medicationProperty;
					this.plugin.settings.sexualActivityProperty = DEFAULT_SETTINGS.sexualActivityProperty;
					
					// Update the previous valid values as well
					this.initializePreviousValidValues();
					
					// Save the settings
					await this.plugin.saveSettings();
					
					// Refresh the settings display to show the updated values
					this.display();
				}));
		
		// Physical symptoms settings
		containerEl.createEl('h3', { text: 'Physical Symptoms' });
		
		this.createPropertySetting(
			containerEl,
			'Track Period Flow',
			'Track period flow intensity (none, light, medium, heavy)',
			'trackPeriodFlow',
			'periodFlowProperty',
			'period_flow'
		);
		
		this.createPropertySetting(
			containerEl,
			'Track Vaginal Discharge',
			'Track vaginal discharge (amount, texture, color)',
			'trackDischarge',
			'dischargeProperty',
			'discharge'
		);
		
		this.createPropertySetting(
			containerEl,
			'Track Cramps',
			'Track if cramps are present (yes, no)',
			'trackCramps',
			'crampsProperty',
			'cramps'
		);
		
		this.createPropertySetting(
			containerEl,
			'Track Bloating',
			'Track if bloating is present (yes, no)',
			'trackBloating',
			'bloatingProperty',
			'bloating'
		);
		
		this.createPropertySetting(
			containerEl,
			'Track Breast Tenderness',
			'Track if breast tenderness is present (yes, no)',
			'trackBreastTenderness',
			'breastTendernessProperty',
			'breast_tenderness'
		);
		
		this.createPropertySetting(
			containerEl,
			'Track Headaches/Migraines',
			'Track if headaches are present (yes, no)',
			'trackHeadaches',
			'headachesProperty',
			'headaches'
		);
		
		this.createPropertySetting(
			containerEl,
			'Track Bowel Changes',
			'Track bowel changes (none, constipation, diarrhea)',
			'trackBowelChanges',
			'bowelChangesProperty',
			'bowel_changes'
		);
				
		// Emotional & Mental State settings
		containerEl.createEl('h3', { text: 'Emotional & Mental State' });
		
		this.createPropertySetting(
			containerEl,
			'Track Mood',
			'Track mood (happy, sad, irritable, anxious, etc.)',
			'trackMood',
			'moodProperty',
			'mood'
		);
		
		this.createPropertySetting(
			containerEl,
			'Track Energy Levels',
			'Track energy levels (low, medium, high)',
			'trackEnergyLevels',
			'energyLevelsProperty',
			'energy'
		);
		
		this.createPropertySetting(
			containerEl,
			'Track Anxiety',
			'Track anxiety levels (none, low, high)',
			'trackAnxiety',
			'anxietyProperty',
			'anxiety'
		);
		
		this.createPropertySetting(
			containerEl,
			'Track Concentration',
			'Track concentration levels (low, medium, high)',
			'trackConcentration',
			'concentrationProperty',
			'concentration'
		);
		
		this.createPropertySetting(
			containerEl,
			'Track Sex Drive',
			'Track sex drive (low, medium, high)',
			'trackSexDrive',
			'sexDriveProperty',
			'sex_drive'
		);
		
		// Lifestyle Factors settings
		containerEl.createEl('h3', { text: 'Lifestyle Factors' });
		
		this.createPropertySetting(
			containerEl,
			'Track Physical Activity',
			'Track physical activity/exercise (type, duration, intensity)',
			'trackPhysicalActivity',
			'physicalActivityProperty',
			'physical_activity'
		);
		
		this.createPropertySetting(
			containerEl,
			'Track Nutrition',
			'Track nutrition (cravings, appetite changes)',
			'trackNutrition',
			'nutritionProperty',
			'nutrition'
		);
		
		this.createPropertySetting(
			containerEl,
			'Track Water Intake',
			'Track water intake',
			'trackWaterIntake',
			'waterIntakeProperty',
			'water_intake'
		);
		
		this.createPropertySetting(
			containerEl,
			'Track Alcohol Consumption',
			'Track alcohol consumption',
			'trackAlcoholConsumption',
			'alcoholConsumptionProperty',
			'alcohol'
		);
		
		this.createPropertySetting(
			containerEl,
			'Track Medication',
			'Track medication taken (including supplements, birth control)',
			'trackMedication',
			'medicationProperty',
			'medication'
		);
		
		this.createPropertySetting(
			containerEl,
			'Track Sexual Activity',
			'Track sexual activity (protected/unprotected)',
			'trackSexualActivity',
			'sexualActivityProperty',
			'sexual_activity'
		);
				
		// Add help information
		containerEl.createEl('h3', { text: 'How to Use' });
		const helpText = containerEl.createEl('div');
		helpText.innerHTML = `
			<p>This plugin reads property values from your daily notes to track your menstrual cycle and related symptoms.</p>
			<p><strong>Property Name Requirements:</strong></p>
			<ul>
				<li>Must start with a letter or underscore</li>
				<li>Can contain letters, numbers, underscores, and hyphens</li>
				<li>No spaces or special characters allowed</li>
				<li>Maximum 50 characters</li>
			</ul>
			<p><strong>Add properties to your daily notes using one of these formats:</strong></p>
			<pre>---
period_flow: medium
cramps: yes
mood: irritable
---</pre>
			<p>OR</p>
			<pre>period_flow:: medium
cramps:: yes
mood:: irritable</pre>
			<p>OR</p>
			<pre>| period_flow | medium |
| cramps | yes |
| mood | irritable |</pre>
			<p>Then view your cycle data by clicking the cycle tracker icon in the left sidebar or by using the "Open Cycle Tracker" command.</p>
		`;
	}
}
