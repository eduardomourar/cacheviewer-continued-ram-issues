#!/bin/bash

ZIP=$(which zip)
if [ "${ZIP:(-3)}" != "zip" ]; then
	echo "Please install the 'zip' utility somewhere in your PATH."
	exit 1
fi

if [ -f cacheviewer.xpi ]; then
	rm cacheviewer*.xpi
fi

zip -qr cacheviewer.xpi . -x \*.xpi \*.DS\* \*.hg\*/\* .hgignore .hgtags build.sh

HGNODE=$(hg hist -r -1 --template "{node}")
HGNODE=${HGNODE:0:12} # short form of Hg changeset id
cp cacheviewer.xpi cacheviewer-${HGNODE}.xpi
