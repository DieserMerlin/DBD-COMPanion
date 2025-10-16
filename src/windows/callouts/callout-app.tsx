import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import { useDebounce } from "@uidotdev/usehooks";
import { motion } from 'motion/react';
import { CSSProperties, useEffect, useState } from "react";
import { create } from "zustand";
import { GameStateGuesser, GameStateMap } from "../../game_state/GameState";
import { MapDirectory } from "../../generated-map-directory";
import { useHotkeys } from "../../utils/hooks/hotkey-hook";
import { BaseWindow } from "../../utils/window/AppWindow";
import { CalloutMapBrowser } from "./browser/CalloutBrowser";
import { CALLOUT_SETTINGS } from "./callout-settings";

const CustomChip = (props: { label: string, hotkey: string, style?: CSSProperties }) => {
  return (
    <Stack direction={'row'} spacing={.5} style={props.style} sx={t => ({
      px: .8,
      py: .4,
      fontSize: '.65em',
      bgcolor: t.palette.background.paper,
    })}>
      <span>{props.label}</span>
      <b>{props.hotkey}</b>
    </Stack>
  );
}

const mockRealm: keyof typeof MapDirectory = "Autohaven Wreckers";
const mockMapFile: typeof MapDirectory[typeof mockRealm][number] = "Wreckers Yard.webp";
const mockMap = GameStateGuesser.makeMap({ realm: mockRealm, mapFile: mockMapFile, match: 1 });

const CalloutView = (props: { mock: boolean, browser: boolean, direction: 'left' | 'right' }) => {
  const show = CALLOUT_SETTINGS.hook(s => s.show) || props.mock;
  const showHotkeys = CALLOUT_SETTINGS.hook(s => s.showHotkeys);

  const _map = CALLOUT_SETTINGS.hook(s => s.map);
  const [manualMap, setManualMap] = useState<GameStateMap | null>(null);

  const map = (_map || manualMap || (props.mock && mockMap));

  useEffect(() => {
    if (manualMap) CALLOUT_SETTINGS.update({ show: true, browser: false });
  }, [manualMap]);

  const { map_browser, map_showhide, map_switch_variant } = useHotkeys();

  return (
    <Stack width={'100%'} height={'100%'} spacing={.5}>
      <Grid container spacing={.5} justifyContent={props.direction === 'right' ? 'flex-end' : undefined}>
        {showHotkeys && <>
          {!!map && <CustomChip label="Show/Hide Map" hotkey={map_showhide} />}
          {!!map && !!map.variants?.length && <CustomChip label="Switch Variant" hotkey={map_switch_variant} />}
          <CustomChip label="Map-Browser" hotkey={map_browser} />
        </>}
        {!!map && !!show && !!map.credit && <CustomChip label="Graphic by" hotkey={map.credit} />}
      </Grid>
      <motion.div
        animate={{ opacity: show ? 1 : 0 }}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'auto',
          backgroundImage: !!map ? 'url("' + map.fullPath + '")' : undefined,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: props.direction === 'right' ? 'top right' : 'top left',
        }}>
        {props.browser && <CalloutMapBrowser current={map} onSelect={setManualMap} />}
      </motion.div>
    </Stack>
  );
}

export const useCalloutOrientation = create<'left' | 'right'>(() => 'left');

export const CalloutApp = () => {
  const undebouncedSize = CALLOUT_SETTINGS.hook(s => (.4 + .6 * s.size) * 100);
  const size = useDebounce(undebouncedSize, 10);

  const undebouncedOpacity = CALLOUT_SETTINGS.hook(s => s.opacity);
  const opacity = useDebounce(undebouncedOpacity, 10);

  const _mock = undebouncedSize !== size || undebouncedOpacity !== opacity;
  const [mock, setMock] = useState(false);

  const browser = CALLOUT_SETTINGS.hook(s => s.browser) && !mock;

  useEffect(() => {
    if (_mock) return setMock(true);
    const t = setTimeout(() => setMock(false), 1000);
    return () => clearTimeout(t);
  }, [_mock]);

  useEffect(() => {
    const keyboardListener = (e: KeyboardEvent) => e.stopPropagation();
    window.addEventListener('keydown', keyboardListener);
    window.addEventListener('keyup', keyboardListener);
    window.addEventListener('keypress', keyboardListener);
    return () => {
      window.removeEventListener('keydown', keyboardListener);
      window.removeEventListener('keyup', keyboardListener);
      window.removeEventListener('keypress', keyboardListener);
    }
  }, []);

  const orientation = useCalloutOrientation();

  return (
    <BaseWindow fullWindowDrag transparent>
      <motion.div
        key='callout'
        layout
        style={{ position: 'absolute', width: size + 'vw', height: size + 'vh', ...(orientation === 'left' ? { left: 0 } : { right: 0 }) }}
        animate={{ opacity: browser ? 1 : opacity }}
      >
        <CalloutView mock={mock} browser={browser} direction={orientation} />
      </motion.div>
    </BaseWindow>
  );
}