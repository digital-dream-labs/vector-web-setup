# FAQ

## Why is Chrome the only browser supported?

We use the BluetoothLE standard to communicate with Vector. Chrome provides the most comprehensive support for the big four browers (Chrome, IE, Safari, Firefox) and is the only one that is functional as of the time of writing. We do make a **capabilities check** for Bluetooth support and not a **software check** for Chrome so if another less known browser supports the standard, or another browser implements the capabilities in the future the software should run and bypass the screen saying you need to use chrome.

## Why doesn't my connection work when serving the software from a location other than http://localhost:8000 ?

There are two conflicting security concerns:

1. Chrome's implementation of Bluetooth only allows it to run on https so that someone can not exploit a bluetooth connection. However for development purposes they let a developer have access to the functionality on localhost, but **only on http**. so we can either run without a TLS connection on localhost, or with one on a real public-facing domain.

2. Our cloud-side stack implements CORS based security which allows restricted access to the resources based on the domain name that contacts us. For our stack we only want to allow authorized clients we know about, or someone running locally on their machine where they understand the risks.

When future users are running the Escape Pod and variant software they will have control over CORS settings and will be able to configure their domains appropriately.

## But why do you use Bluetooth and not ssh/https/ftp/etc when it has all these limitations ?

There are two reasons for this:

1. Security is a paramount concern for a fleet of over a million robots that sit in people's homes and have a camera and microphone. We take security and privacy very seriously. Using bluetooth combined with a pairing protocol ensures that the device is being configured by a real person in physical proximity of the robot and not a malicious actor, spyware, virus, etc, from a country of unknown origin.

2. Although later versions of Vector's software allow limited admin communications via an https interface this is not installed on the **factory firmware** that is initially loaded on to the Vector. This software is intentionally minimal and we keep the same version on every robot so that upgrades will behave predictably. It is important that our software is always able to do a full update on a Vector with the factory firmware so we always assume we have a minimal set of capabilities.

## I've installed my favorite old version of the software, but it gets reset to the latest the next day. Can I stop this?

There is currently no means to disable automatic updates. This will change as Digital Dream Labs roles out the full escape pod. For now advanced users can disable automatic updates by modifying their local DNS server or modifying a PiHole to block the endpoints where the vector tries to receive the update so it can't download a new file. If you understand what all this means the domains to block are:

* ota.global.anki-services.com
* ota-cdn.anki.com

