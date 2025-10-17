import Stack from "@mui/material/Stack";
import { Tutorial, useTutorial } from "../AppTutorial";
import { IngameAppTab, useIngameApp } from "../../use-ingame-app";
import { AppSettingsSection, useAppSettings } from "../../settings/use-app-settings";
import Link from "@mui/material/Link";
import Alert from "@mui/material/Alert";
import { SettingsHotkey } from "../../settings/AppSettingsHotkey";

const openCalloutSettings = () => { useIngameApp.setState({ tab: IngameAppTab.SETTINGS }); useAppSettings.setState({ expand: AppSettingsSection.MODE_1v1 }); useTutorial.getState().clear(); };
const SettingsLink = () => <Link onClick={openCalloutSettings}>Settings</Link>;

export const CALLOUT_TUTORIAL: Tutorial = {
  title: 'Callout Overlay',
  content: (
    <>
      <Stack>
        <span>Need a cheat sheet?</span>
        <span>I got you! Fully customizable map overlays.</span>
      </Stack>
      <span>Change <b>Size</b>, <b>Opacity</b> and display of <b>Hotkeys</b> in the <SettingsLink />.</span>
      <span>Move the map to another position on the <b>Overwolf Overlay</b>.</span>
    </>
  ),
  notice: <>You can turn also turn the map off using (<SettingsHotkey name="map_showhide" />).</>,
  media: { type: 'video', src: './videos/1.mp4', position: 'right' },
  steps: [
    {
      title: 'Work smart, not hard 🧠',
      content: (
        <>
          <span>The <b>auto-detection</b> selects the correct map-overlay automatically!</span>
          <Stack>
            <span>How it works?</span>
            <span>I take periodic peeks at your game and recognize the text on the lower left corner at trial-start!</span>
          </Stack>
          <span>After the trial, the map gets de-selected automatically.</span>
          <Alert variant="outlined" severity="warning">
            Two things to consider:
            <ul>
              <li>DBD needs to be in focus for it to work, so <b>don't tab out while the match starts</b>!</li>
              <li>Also, the text must be clearly visible. <b>Avoid putting any overlays there.</b></li>
            </ul>
          </Alert>
          <span>Also, this is experimental and a bit hacky ngl 😅</span>
        </>
      ),
      notice: <>This feature can be disabled in the <SettingsLink />.</>,
      media: { type: "video", src: './videos/3.mp4', position: 'left' }
    },
    {
      title: 'Switch map variants',
      content: (
        <Stack>
          <span>Some maps have multiple variations with the same name.</span>
          <span>On those, you can switch variants using (<SettingsHotkey name="map_switch_variant" />).</span>
        </Stack>
      ),
      notice: "It'll be possible to use custom graphics in the future.",
      media: { type: 'video', src: './videos/4.mp4', position: 'left' }
    },
    {
      title: 'Select maps manually',
      content: (
        <>
          <Stack>
            <span>In case a map detection failed or you want to select maps manually, open the <b>Map-Browser</b> using (<SettingsHotkey name="map_browser" />).</span>
            <span>You can navigate it using <b>WASD</b> or the <b>Arrow keys</b>.</span>
          </Stack>
          <Alert variant="outlined" severity="warning">
            Be aware that having auto-detection on will prioritize the auto-detected map.
          </Alert>
        </>
      ),
      media: { type: 'video', src: './videos/2.mp4', position: 'left' }
    }
  ]
}
