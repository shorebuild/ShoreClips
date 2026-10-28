package net.shoreclips.mod;

import java.net.URI;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

public final class ShoreClipsScreen extends Screen {
    private enum Page { MAIN, HOTKEY, SETTINGS, DISCORDS, CLIPS }
    private final Screen parent;
    private Page page = Page.MAIN;

    public ShoreClipsScreen(Screen parent) {
        super(Component.literal("ShoreClips Settings"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        clearWidgets();
        int center = width / 2;
        int buttonWidth = Math.min(210, (width - 40) / 2);
        int left = center - buttonWidth - 3;
        int right = center + 3;
        int top = Math.max(95, height / 2 - 62);

        if (page == Page.MAIN) {
            addRenderableWidget(Button.builder(Component.literal("⌨ Hotkey  ▸"), b -> change(Page.HOTKEY))
                    .bounds(left, top, buttonWidth, 25).build());
            addRenderableWidget(Button.builder(Component.literal("▤ Clips  ▸"), b -> change(Page.CLIPS))
                    .bounds(right, top, buttonWidth, 25).build());
            addRenderableWidget(Button.builder(Component.literal("⚙ Settings  ▸"), b -> change(Page.SETTINGS))
                    .bounds(left, top + 31, buttonWidth, 25).build());
            addRenderableWidget(Button.builder(Component.literal("✦ Discords  ▸"), b -> change(Page.DISCORDS))
                    .bounds(right, top + 31, buttonWidth, 25).build());
            addRenderableWidget(Button.builder(Component.literal("Replay duration: " + ShoreClipsClient.CONFIG.durationSeconds + " seconds"), b -> {
                int[] durations = {15, 30, 45, 60, 90, 120, 180, 300};
                int current = 0;
                for (int i = 0; i < durations.length; i++) {
                    if (durations[i] == ShoreClipsClient.CONFIG.durationSeconds) current = i;
                }
                ShoreClipsClient.CONFIG.durationSeconds = durations[(current + 1) % durations.length];
                ShoreClipsClient.CONFIG.save();
                init();
            }).bounds(center - buttonWidth, top + 62, buttonWidth * 2, 25).build());
        } else if (page == Page.HOTKEY) {
            addRenderableWidget(Button.builder(Component.literal("Default: F7 · change in Options > Controls"), b -> openControlsHelp())
                    .bounds(center - 180, top, 360, 25).build());
            addRenderableWidget(Button.builder(Component.literal("Open Minecraft controls"), b -> open("https://minecraft.wiki/w/Controls"))
                    .bounds(center - 140, top + 31, 280, 25).build());
        } else if (page == Page.SETTINGS) {
            addRenderableWidget(Button.builder(Component.literal("Replay duration: " + ShoreClipsClient.CONFIG.durationSeconds + " sec"), b -> {
                int[] durations = {15, 30, 45, 60, 90, 120, 180, 300};
                int current = 0;
                for (int i = 0; i < durations.length; i++) if (durations[i] == ShoreClipsClient.CONFIG.durationSeconds) current = i;
                ShoreClipsClient.CONFIG.durationSeconds = durations[(current + 1) % durations.length];
                ShoreClipsClient.CONFIG.save();
                init();
            }).bounds(center - 180, top, 360, 25).build());
            addRenderableWidget(Button.builder(Component.literal("Achievement-style notification: " + (ShoreClipsClient.CONFIG.achievementStyle ? "ON" : "OFF")), b -> {
                ShoreClipsClient.CONFIG.achievementStyle = !ShoreClipsClient.CONFIG.achievementStyle;
                ShoreClipsClient.CONFIG.save();
                init();
            }).bounds(center - 180, top + 31, 360, 25).build());
            addRenderableWidget(Button.builder(Component.literal("Notification icon: " + ShoreClipsClient.CONFIG.achievementItem + " (cycle)"), b -> {
                String[] items = {"chest", "diamond", "emerald", "gold_ingot", "totem_of_undying", "nether_star"};
                int at = 0;
                for (int i = 0; i < items.length; i++) if (items[i].equals(ShoreClipsClient.CONFIG.achievementItem)) at = i;
                ShoreClipsClient.CONFIG.achievementItem = items[(at + 1) % items.length];
                ShoreClipsClient.CONFIG.save();
                init();
            }).bounds(center - 180, top + 62, 360, 25).build());
            addRenderableWidget(Button.builder(Component.literal("Toggle message: " + ShoreClipsClient.CONFIG.savedMessage), b -> {
                ShoreClipsClient.CONFIG.savedMessage = ShoreClipsClient.CONFIG.savedMessage.equals("Clip Saved") ? "Saved your replay" : "Clip Saved";
                ShoreClipsClient.CONFIG.save();
                init();
            }).bounds(center - 180, top + 93, 360, 25).build());
        } else if (page == Page.DISCORDS) {
            addRenderableWidget(Button.builder(Component.literal("ShoreSMP"), b -> open("https://discord.gg/shoresmp"))
                    .bounds(center - 140, top, 280, 22).build());
            addRenderableWidget(Button.builder(Component.literal("ShoreSMP Giveaway"), b -> open("https://discord.gg/shoregiveaways"))
                    .bounds(center - 140, top + 26, 280, 22).build());
            addRenderableWidget(Button.builder(Component.literal("ShoreSMP Support"), b -> open("https://discord.gg/shoresupport"))
                    .bounds(center - 140, top + 52, 280, 22).build());
            addRenderableWidget(Button.builder(Component.literal("ShoreBuild"), b -> open("https://discord.gg/shorebuilds"))
                    .bounds(center - 140, top + 78, 280, 22).build());
        } else if (page == Page.CLIPS) {
            addRenderableWidget(Button.builder(Component.literal("Open my ShoreClips account"), b -> open("https://shoreclips.pages.dev/account"))
                    .bounds(center - 160, top, 320, 25).build());
        }

        addRenderableWidget(Button.builder(Component.literal(page == Page.MAIN ? "Close" : "Back"), b -> {
            if (page != Page.MAIN) change(Page.MAIN);
            else onClose();
        }).bounds(center - 100, height - 36, 200, 22).build());
    }

    private void change(Page next) {
        page = next;
        init();
    }

    private void openControlsHelp() {
        if (Minecraft.getInstance().player != null) {
            Minecraft.getInstance().gui.getChat().addMessage(
                    Component.literal("Change 'ShoreClips: Save replay' in Options > Controls > Key Binds."));
        }
    }

    private void open(String uri) {
        try {
            if (java.awt.Desktop.isDesktopSupported()) java.awt.Desktop.getDesktop().browse(URI.create(uri));
            else throw new IllegalStateException("Desktop browsing unavailable");
        } catch (Exception exception) {
            if (Minecraft.getInstance().player != null) {
                Minecraft.getInstance().gui.getChat().addMessage(Component.literal("Could not open link."));
            }
        }
    }

    @Override
    public void extractRenderState(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float delta) {
        super.extractRenderState(graphics, mouseX, mouseY, delta);
        graphics.fill(0, 0, width, 62, 0xB9000000);
        String heading = page == Page.MAIN ? "ShoreClips Settings" : page.name().replace('_', ' ');
        graphics.text(font, heading, (width - font.width(heading)) / 2, 22, 0xFFFFFFFF, true);
        String subtitle = switch (page) {
            case MAIN -> "Choose a category to change your settings.";
            case HOTKEY -> "Change the replay key in Minecraft's Controls menu.";
            case SETTINGS -> "Customize replay duration and saved messages.";
            case DISCORDS -> "Join one of the Shore communities.";
            case CLIPS -> "Open your online clip library.";
        };
        graphics.text(font, subtitle, (width - font.width(subtitle)) / 2, Math.max(70, height / 2 - 89), 0xFFDDDDDD, true);
    }

    @Override
    public void onClose() {
        Minecraft.getInstance().setScreen(parent);
    }
}
