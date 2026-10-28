package net.shoreclips.mod;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

public final class LinkCodeScreen extends Screen {
    private final Screen parent;
    private EditBox code;
    private String status = "Enter the six-digit code from your website account.";
    private boolean busy;

    public LinkCodeScreen(Screen parent) {
        super(Component.literal("Link ShoreClips Account"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        int cx = width / 2;
        code = new EditBox(font, cx - 100, height / 2 - 22, 200, 20, Component.literal("6-digit code"));
        code.setMaxLength(6);
        code.setFilter(value -> value.matches("[0-9]*"));
        addRenderableWidget(code);
        addRenderableWidget(Button.builder(Component.literal("Link account"), button -> submit())
                .bounds(cx - 100, height / 2 + 8, 200, 22).build());
        addRenderableWidget(Button.builder(Component.literal("Cancel"), button -> onClose())
                .bounds(cx - 100, height / 2 + 36, 200, 22).build());
        setInitialFocus(code);
    }

    private void submit() {
        if (busy || code.getValue().length() != 6) {
            status = "Enter all six digits.";
            return;
        }
        busy = true;
        status = "Linking account…";
        BridgeClient.linkCode(code.getValue(), result -> Minecraft.getInstance().execute(() -> {
            busy = false;
            status = result.message();
            if (result.ok()) Minecraft.getInstance().gui.setScreen(new ShoreClipsScreen(parent));
        }));
    }

    @Override
    public void extractRenderState(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float delta) {
        super.extractRenderState(graphics, mouseX, mouseY, delta);
        String heading = "Link ShoreClips";
        graphics.text(font, heading, (width - font.width(heading)) / 2, height / 2 - 72, 0xFFFFFFFF, true);
        graphics.text(font, status, (width - font.width(status)) / 2, height / 2 + 68, 0xFFDDDDDD, true);
    }

    @Override
    public void onClose() {
        Minecraft.getInstance().gui.setScreen(parent);
    }
}
