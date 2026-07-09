# Bakes JKI VIPM and a headless-display entrypoint into the official NI LabVIEW
# Linux image so that `docker run <image> vipm build <spec> ...` works out of the
# box. Mirrors the JKI VIPM Linux-container recipe:
# https://docs.vipm.io/preview/cli/docker/#display-and-labview-setup-linux-containers
ARG LABVIEW_IMAGE=2026q1patch2-linux
FROM nationalinstruments/labview:${LABVIEW_IMAGE}

# LABVIEW_VERSION_YEAR drives the headless LabVIEW binary path; keep it in sync
# with the base image tag. VIPM env matches the community-edition CLI recipe.
ENV LABVIEW_VERSION_YEAR=2026 \
    VIPM_COMMUNITY_EDITION=true \
    VIPM_DESKTOP_LIVELINESS_TIMEOUT=300 \
    DISPLAY=:99

# JKI VIPM .deb. Defaults to the preview channel; override --build-arg for a
# pinned release (e.g. https://traffic.libsyn.com/secure/jkinc/vipm_<ver>_amd64.deb).
ARG VIPM_DEB_URL=https://packages.jki.net/vipm/preview/vipm_latest_preview_amd64.deb

RUN apt-get update \
 && apt-get install -y --no-install-recommends wget ca-certificates git \
 && wget -O /tmp/vipm.deb "${VIPM_DEB_URL}" \
 && dpkg -i /tmp/vipm.deb \
 && rm -f /tmp/vipm.deb \
 && rm -rf /var/lib/apt/lists/* \
 && vipm --version

COPY entrypoint.sh /usr/local/bin/lvpb-entrypoint.sh
COPY vipm-build.sh /usr/local/bin/lvpb-vipm-build
RUN chmod +x /usr/local/bin/lvpb-entrypoint.sh /usr/local/bin/lvpb-vipm-build

ENTRYPOINT ["/usr/local/bin/lvpb-entrypoint.sh"]
