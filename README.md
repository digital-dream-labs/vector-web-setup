# Vector Web Setup

Vector Web Setup provides an open source tool to allow users of Vector
to configure their robot without relying on the proprietary phone
application that previously provided the only method a user could use
to configure their robot.

As Digital Dream Labs releases both the Escape Pod and OSKR code it is
anticipated this tool will become an important part of the system by
which users deploy both their own server side code, and their own
custom software images to the robot.

For now it simply provides an alternative to the existing phone
application and allows users to maintain local copies of the operating
system images for redundancy purposes.

The software is written in [Node.js](https://nodejs.org) and should run anywhere you can
run Node.js. It is tested on Windows, Mac OSX, and Linux.

## Normal End-User Usage

Most users will simply want to run a copy of the web server locally to
interact with their robot. They will not need to use github to do
this.

One-time install:

1. Install [Node.js](https://nodejs.org/en/download/), however that is done on their system.
1. Install vector-web-setup package: `npm install -g vector-web-setup`
1. Perform an initial configuration: `vector-web-setup configure`
1. Perform a local sync of software files: `vector-web-setup ota-sync`

Daily usage:

1. Start the web-server: `vector-web-setup serve`
1. Open a Chrome Browser and go to http://localhost:8000/.
1. Follow the instructions provided by the web application.

> NOTE:
The application talks to the robot via Bluetooth Low-Energe protocol (BLE). There is a
standard for browsers to support this but it is currently only
**implemented on Chrome**. Until that changes, use of the Chrome browser is
required. BLE is only enabled on `https://` sites or `http://localhost`.

## Advanced - Admin usage

As we release firmware to unlock OSKR robots or other alternate
firmwares users may wish to install different firmwares for
installation. There is a two-step process for this. First a file is
downloaded and included in the manifest. After verifying that the file
has downloaded correctly and completely it is signed with a
checksum. This allows future users to distribute their own
configurations to other users.

### Custom port

You can override the default 8000 port with your own by specifying a number between 0-65535 (avoid using [reserved ports](https://en.wikipedia.org/wiki/List_of_TCP_and_UDP_port_numbers)
Example: `vector-web-setup serve -p 7010` will serve the website at http://localhost:7010.


## **Examples**

### Example: use GooeyChickenman archives

There are backups of the firmware available via the user
GooeyChickenman on github. Lets pretend that for some reason the
official copies of the firmware are down, and you want to use the
GooeyChickenman files as a replacement:

1. Add the new file to the inventory: `vector-web-setup ota-add https://github.com/GooeyChickenman/victor/raw/master/firmware/prod/1.6.0.3331.ota`
1. Download the file: `vector-web-setup ota-sync`
1. Install it on a robot by running the software and selecting the new
    file.
1. Sign the file after you've verified it's good: `vector-web-setup ota-approve 1.6.0.3331.ota`

### Example: Add OSKR image locally

### Example: Distribute Your configuration to another user

### Example: Install another user's configuration

## Contributions

Contributions from the community are always welcome!

For something simple such as fixing a typo or adjusting the css layout
for a certain device simply create a pull request and we'll take a
look.

If you have more substantial customizations or redesign it is highly
recommended that you open an advisory issue to discuss with the team
**before** spending significant time developing a solution that may be
rejected for various reasons.

Any submitted pull request should pass the test suite run with `npm
test` and will hopefully have additional tests as needed. It should
also include a friendly entry in `CHANGELOG.md` describing the
change/enhancement/fix.

And as always, the project can be forked permanently if you want to make
significant changes without needing our permission!

