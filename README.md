# Vertical Overview
*WARNING this is very much a work in progress.*

Gnome has had vertically stacked workspaces for a long time. The Gnome 40 update unfortunately made the switch to a horizontal layout.
A choice that many Gnome users disagree with. This extension completely replaces the new Gnome overview with something that resembles the old style.

In the future I'd like to add options to customize the exact layout and add support for the Dash-to-Panel extension.

Installing:
```
$ git clone https://github.com/RensAlthuis/vertical-overview.git
$ cd vertical-overview
$ make
$ make install

if you use X11:
    reload the server (press alt+f2, type r)

if you use Wayland:
    logout/log in

$ gnome-extensions enable vertical-overview@RensAlthuis.github.com
```

![image](../assets/vertical-overview.png)
![Example video](https://user-images.githubusercontent.com/12956267/112723092-2c915180-8f0d-11eb-802a-9a624a21791a.mp4) of gesture animations.
