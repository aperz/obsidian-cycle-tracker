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

	constructor(app: App, plugin: CycleTracker) {
		super(app, plugin);
		this.plugin = plugin;
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
			text: 'Configure which symptoms to track and specify the property names used in your daily notes.' 
		});
		
		// Physical symptoms settings
		containerEl.createEl('h3', { text: 'Physical Symptoms' });
		
		new Setting(containerEl)
			.setName('Track Period Flow')
			.setDesc('Track period flow intensity (none, light, medium, heavy)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackPeriodFlow)
				.onChange(async (value) => {
					this.plugin.settings.trackPeriodFlow = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('period_flow')
				.setValue(this.plugin.settings.periodFlowProperty)
				.onChange(async (value) => {
					this.plugin.settings.periodFlowProperty = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Track Vaginal Discharge')
			.setDesc('Track vaginal discharge (amount, texture, color)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackDischarge)
				.onChange(async (value) => {
					this.plugin.settings.trackDischarge = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('discharge')
				.setValue(this.plugin.settings.dischargeProperty)
				.onChange(async (value) => {
					this.plugin.settings.dischargeProperty = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Track Cramps')
			.setDesc('Track if cramps are present (yes, no)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackCramps)
				.onChange(async (value) => {
					this.plugin.settings.trackCramps = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('cramps')
				.setValue(this.plugin.settings.crampsProperty)
				.onChange(async (value) => {
					this.plugin.settings.crampsProperty = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Track Bloating')
			.setDesc('Track if bloating is present (yes, no)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackBloating)
				.onChange(async (value) => {
					this.plugin.settings.trackBloating = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('bloating')
				.setValue(this.plugin.settings.bloatingProperty)
				.onChange(async (value) => {
					this.plugin.settings.bloatingProperty = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Track Breast Tenderness')
			.setDesc('Track if breast tenderness is present (yes, no)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackBreastTenderness)
				.onChange(async (value) => {
					this.plugin.settings.trackBreastTenderness = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('breast_tenderness')
				.setValue(this.plugin.settings.breastTendernessProperty)
				.onChange(async (value) => {
					this.plugin.settings.breastTendernessProperty = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Track Headaches/Migraines')
			.setDesc('Track if headaches are present (yes, no)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackHeadaches)
				.onChange(async (value) => {
					this.plugin.settings.trackHeadaches = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('headaches')
				.setValue(this.plugin.settings.headachesProperty)
				.onChange(async (value) => {
					this.plugin.settings.headachesProperty = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Track Bowel Changes')
			.setDesc('Track bowel changes (none, constipation, diarrhea)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackBowelChanges)
				.onChange(async (value) => {
					this.plugin.settings.trackBowelChanges = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('bowel_changes')
				.setValue(this.plugin.settings.bowelChangesProperty)
				.onChange(async (value) => {
					this.plugin.settings.bowelChangesProperty = value;
					await this.plugin.saveSettings();
				}));
				
		// Emotional & Mental State settings
		containerEl.createEl('h3', { text: 'Emotional & Mental State' });
		
		new Setting(containerEl)
			.setName('Track Mood')
			.setDesc('Track mood (happy, sad, irritable, anxious, etc.)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackMood)
				.onChange(async (value) => {
					this.plugin.settings.trackMood = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('mood')
				.setValue(this.plugin.settings.moodProperty)
				.onChange(async (value) => {
					this.plugin.settings.moodProperty = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Track Energy Levels')
			.setDesc('Track energy levels (low, medium, high)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackEnergyLevels)
				.onChange(async (value) => {
					this.plugin.settings.trackEnergyLevels = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('energy')
				.setValue(this.plugin.settings.energyLevelsProperty)
				.onChange(async (value) => {
					this.plugin.settings.energyLevelsProperty = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Track Anxiety')
			.setDesc('Track anxiety levels (none, low, high)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackAnxiety)
				.onChange(async (value) => {
					this.plugin.settings.trackAnxiety = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('anxiety')
				.setValue(this.plugin.settings.anxietyProperty)
				.onChange(async (value) => {
					this.plugin.settings.anxietyProperty = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Track Concentration')
			.setDesc('Track concentration levels (low, medium, high)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackConcentration)
				.onChange(async (value) => {
					this.plugin.settings.trackConcentration = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('concentration')
				.setValue(this.plugin.settings.concentrationProperty)
				.onChange(async (value) => {
					this.plugin.settings.concentrationProperty = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Track Sex Drive')
			.setDesc('Track sex drive (low, medium, high)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackSexDrive)
				.onChange(async (value) => {
					this.plugin.settings.trackSexDrive = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('sex_drive')
				.setValue(this.plugin.settings.sexDriveProperty)
				.onChange(async (value) => {
					this.plugin.settings.sexDriveProperty = value;
					await this.plugin.saveSettings();
				}));
				
		// Lifestyle Factors settings
		containerEl.createEl('h3', { text: 'Lifestyle Factors' });
		
		new Setting(containerEl)
			.setName('Track Physical Activity')
			.setDesc('Track physical activity/exercise (type, duration, intensity)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackPhysicalActivity)
				.onChange(async (value) => {
					this.plugin.settings.trackPhysicalActivity = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('physical_activity')
				.setValue(this.plugin.settings.physicalActivityProperty)
				.onChange(async (value) => {
					this.plugin.settings.physicalActivityProperty = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Track Nutrition')
			.setDesc('Track nutrition (cravings, appetite changes)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackNutrition)
				.onChange(async (value) => {
					this.plugin.settings.trackNutrition = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('nutrition')
				.setValue(this.plugin.settings.nutritionProperty)
				.onChange(async (value) => {
					this.plugin.settings.nutritionProperty = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Track Water Intake')
			.setDesc('Track water intake')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackWaterIntake)
				.onChange(async (value) => {
					this.plugin.settings.trackWaterIntake = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('water_intake')
				.setValue(this.plugin.settings.waterIntakeProperty)
				.onChange(async (value) => {
					this.plugin.settings.waterIntakeProperty = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Track Alcohol Consumption')
			.setDesc('Track alcohol consumption')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackAlcoholConsumption)
				.onChange(async (value) => {
					this.plugin.settings.trackAlcoholConsumption = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('alcohol')
				.setValue(this.plugin.settings.alcoholConsumptionProperty)
				.onChange(async (value) => {
					this.plugin.settings.alcoholConsumptionProperty = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Track Medication')
			.setDesc('Track medication taken (including supplements, birth control)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackMedication)
				.onChange(async (value) => {
					this.plugin.settings.trackMedication = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('medication')
				.setValue(this.plugin.settings.medicationProperty)
				.onChange(async (value) => {
					this.plugin.settings.medicationProperty = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Track Sexual Activity')
			.setDesc('Track sexual activity (protected/unprotected)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackSexualActivity)
				.onChange(async (value) => {
					this.plugin.settings.trackSexualActivity = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('sexual_activity')
				.setValue(this.plugin.settings.sexualActivityProperty)
				.onChange(async (value) => {
					this.plugin.settings.sexualActivityProperty = value;
					await this.plugin.saveSettings();
				}));
				
		// Add help information
		containerEl.createEl('h3', { text: 'How to Use' });
		const helpText = containerEl.createEl('div');
		helpText.innerHTML = `
			<p>This plugin reads property values from your daily notes to track your menstrual cycle and related symptoms.</p>
			<p>Add properties to your daily notes using one of these formats:</p>
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
