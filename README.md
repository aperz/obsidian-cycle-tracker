# Cycle Tracker for Obsidian

A plugin for tracking your menstrual cycle and related symptoms within Obsidian.

## Features

- Track your menstrual cycle and various physical symptoms
- Monitor mood, energy levels, and other emotional factors
- Log lifestyle factors that may affect your cycle
- View a calendar visualization of your cycle
- See a summary of days since your last period started
- Track ovulation and fertile days
- Customize which symptoms you want to track

## How It Works

The plugin reads properties from your daily notes to track your menstrual cycle and associated symptoms. It doesn't store any data on its own - all your information stays in your Obsidian vault.

### Required Property Format

Add properties to your daily notes in one of these formats:

**YAML Front Matter**:
```yaml
---
period_flow: medium
cramps: yes
mood: irritable
---
```

**Dataview Properties**:
```
period_flow:: medium
cramps:: yes
mood:: irritable
```

**Properties in a Table**:
```
| period_flow | medium |
| cramps | yes |
| mood | irritable |
```

## Using the Plugin

1. Install the plugin from the Obsidian Community Plugins browser
2. Configure which symptoms you want to track in the plugin settings
3. Add the relevant properties to your daily notes (see sample-template.md)
4. Open the Cycle Tracker by clicking the icon in the left sidebar or using the "Open Cycle Tracker" command

## Symptoms You Can Track

### Physical Symptoms

- **Period flow** (none, light, medium, heavy)
- **Vaginal discharge** (amount, texture, color)
- **Cramps** (yes, no)
- **Bloating** (yes, no)
- **Breast tenderness/changes** (yes, no)
- **Headaches/migraines** (yes, no)
- **Bowel changes** (none, constipation, diarrhea)

### Emotional & Mental State

- **Mood** (happy, sad, irritable, anxious, etc.)
- **Energy levels** (ok, fatigue, high energy)
- **Anxiety** (none, low, high)
- **Concentration** (low, medium, high)
- **Sex drive** (low, medium, high)

### Lifestyle Factors

- **Physical activity/exercise** (type, duration, intensity)
- **Nutrition** (cravings, appetite changes)
- **Water intake**
- **Alcohol consumption**
- **Medication taken** (including supplements, birth control)
- **Sexual activity** (protected/unprotected)

## Customization

In the plugin settings, you can:

1. Change the Daily Notes folder location (default: "Daily Notes")
2. Enable/disable tracking for specific symptoms
3. Change the property names used in your daily notes
4. Find a sample template for your daily notes

## Requirements

- Obsidian v0.15.0 or higher
- (Optional but recommended) Dataview plugin

## Installation

1. Download the latest release from the Releases page
2. Extract the zip file into your Obsidian plugins folder: `{vault}/.obsidian/plugins/`
3. Enable the plugin in Obsidian settings

## Development

1. Clone this repository to your Obsidian plugins folder
2. Run `npm install`
3. Run `npm run dev` to start the development build process
4. Enable the plugin in Obsidian settings

### Versioning
Use `npm version` to bump version across relevant files 
(`manifest.json`, `package.json`, `versions.json`).


### Adding and modifying variables
To add or modify variables to track, modify `setting.ts`

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Inspired by the Flo tracker app (https://flo.health/product-tour/tracking-cycle)
- Built using the Obsidian Sample Plugin as a template 
