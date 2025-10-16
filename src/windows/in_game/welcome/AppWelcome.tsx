import { Book, Group, Map, Settings, Timer } from "@mui/icons-material";
import { Alert, Button, Card, CardContent, Checkbox, FormControlLabel, Grid, Stack, Typography } from "@mui/material";
import { PropsWithChildren, ReactElement, useState } from "react";
import { INGAME_SETTINGS } from "../in_game-settings";
import { AppSettingsSection, useAppSettings } from "../settings/use-app-settings";
import { IngameAppTab, useIngameApp } from "../use-ingame-app";

const OnboardingCard = (props: PropsWithChildren<{
  title: string,
  img: string,
  icon: ReactElement,
  onSettings?: () => void,
  onLearnMore?: () => void,
}>) => {
  const [hover, setHover] = useState(false);

  return (
    <Grid size={{ xs: 6 }} sx={{ flexGrow: 1 }}>
      <Card style={{ width: '100%', height: '100%' }} onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
        <CardContent style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
          <Stack height={'100%'} width={'100%'} spacing={1}>
            <Stack spacing={1} width={'100%'} flexGrow={1} justifyContent={'center'}>
              <Stack direction={'row'} alignItems={'center'} spacing={1}>
                {props.icon}
                <Typography variant="h6">{props.title}</Typography>
              </Stack>
              {props.children}
            </Stack>
            <Stack direction={'row'} spacing={1} width={'100%'}>
              {props.onLearnMore && <Button variant="outlined" color="warning" startIcon={<Book />} onClick={props.onLearnMore}>Learn more</Button>}
              {props.onSettings && <Button variant="contained" startIcon={<Settings />} onClick={props.onSettings}>Settings</Button>}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Grid>
  )
}

export const AppWelcome = () => {
  const openOnStartup = INGAME_SETTINGS.hook(s => s.openOnStartup);

  const openSettings = (section: AppSettingsSection) => {
    useIngameApp.setState({ tab: IngameAppTab.SETTINGS });
    useAppSettings.setState({ expand: section });
  }

  return (
    <Stack width={'100%'} height={'100%'} alignItems={'center'} justifyContent={'center'} spacing={2}>
      <Stack>
        <Typography variant="h5">Welcome to the companion app for competitive DBD!</Typography>
        <Typography variant="caption" style={{ opacity: .8 }}>Learn what this app can do for you:</Typography>
      </Stack>
      <Grid container flexGrow={1} spacing={1} width={'90%'}>
        <OnboardingCard icon={<Timer />} title="1v1-Timer" onSettings={() => openSettings(AppSettingsSection.MODE_1v1)} img="">
          <Typography variant="body2">Use the <b>1v1 timer</b> to track your chase time. No external app or smartphone needed!. <b>Crouch</b> or <b>Swing</b> to start the timer!</Typography>
        </OnboardingCard>
        <OnboardingCard icon={<Group />} title="Scrims/Tournaments" img="">
          <Alert variant="outlined" severity="warning">This mode is not yet available.</Alert>
        </OnboardingCard>
        <OnboardingCard icon={<Map />} title="Callout-Overlay" onSettings={() => openSettings(AppSettingsSection.CALLOUT)} img="">
          <Typography variant="body2">Show <b>callout-images</b> as overlay and let the <b>auto-detection</b> work for you!</Typography>
        </OnboardingCard>
      </Grid>
      <FormControlLabel
        style={{ opacity: .75 }}
        label="Open this window with DBD"
        control={<Checkbox checked={openOnStartup} onChange={(_, v) => INGAME_SETTINGS.update({ openOnStartup: v })} />}
      />
    </Stack>
  );
}