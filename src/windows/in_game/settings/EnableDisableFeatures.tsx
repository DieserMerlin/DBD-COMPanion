import Switch from "@mui/material/Switch";
import { BACKGROUND_SETTINGS } from "../../background/background-settings";
import Stack from "@mui/material/Stack";
import { SettingsHotkey } from "./AppSettingsHotkey";

export const EnableCalloutFeature = (props: { small?: true }) => {
  const enabled = BACKGROUND_SETTINGS.hook(s => s.calloutOverlay);

  return (
    <Stack direction={'row'} spacing={1} alignItems={'center'} justifyContent={'center'}>
      <SettingsHotkey name="map_showhide" small={props.small} />
      <Switch checked={enabled} onChange={(_, v) => BACKGROUND_SETTINGS.update({ calloutOverlay: v })} />
    </Stack>
  );
};

export const Enable1v1ModeFeature = (props: { small?: true }) => {
  const enabled = BACKGROUND_SETTINGS.hook(s => s.mode === '1v1');
  const toggle = () => BACKGROUND_SETTINGS.update({ mode: enabled ? null : '1v1' })

  return (
    <Stack direction={'row'} spacing={1} alignItems={'center'}>
      <SettingsHotkey name="mode_1v1" small={props.small} />
      <Switch checked={enabled} onChange={toggle} />
    </Stack>
  );
}
