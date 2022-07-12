# Vertical Overview
**Quick note**: If you run in to issues and are waiting for me to fix them, I apologise in advance. Unfortunately I do not have the time to properly maintain this extension. I do on occasion come back to it (mostly when my own install breaks). However, extensions have a tendency to break with every update and this one modifies a lot of important code. Luckily @G-dH is writing a new vertical workspace extension, that might be worth a shot. You can find it here: [Link](https://github.com/G-dH/vertical-workspaces)

## Description
Gnome has had vertically stacked workspaces for a long time. The Gnome 40 update unfortunately made the switch to a horizontal layout. A choice that many Gnome users disagree with. This extension Aims to replace the new Gnome overview with something that resembles the old style. 


## Preview image
![vertical-overview](https://user-images.githubusercontent.com/12956267/116825963-f0977f00-ab91-11eb-953a-ea891389ddf9.gif)

## Installation:
You install it through [Gnome Extensions](https://extensions.gnome.org/extension/4144/vertical-overview/).

Or you can install it manually:
```
git clone https://github.com/RensAlthuis/vertical-overview.git
cd vertical-overview
make
make install
```

If you use X11, reload the server (press `Alt-F2` and type `r`).
If you use Wayland, log out and log in.
You can detect your Windowing System in Settings → About.

Then enable the extension in "Extensions" application or via command:

```
gnome-extensions enable vertical-overview@RensAlthuis.github.com
```

## FAQ
#### **How do I get back `Super + Page Up/Down` to switch workspaces?**

@romgrk and @m2-farzan have got you covered Until I get around to adding this:
https://github.com/RensAlthuis/vertical-overview/issues/7#issuecomment-816054137



## Donations
I never expected this to be something I have to consider. I really don't expect anyone to donate, nor do I want anyone to feel obligated to do so. I do this because I enjoy it and will for sure keeping working on it as long as I can. However multiple people have asked me to make a donation button, so here it is. If you are considering donating, Thank you so much! I really appreciate it.

[![Donate](https://www.paypalobjects.com/en_US/i/btn/btn_donate_LG.gif)](https://www.paypal.com/donate?hosted_button_id=8JSADCLQR58KJ)
